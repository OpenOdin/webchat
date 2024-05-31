import {
    StreamWriterInterface,
    DataInterface,
    Service,
    BufferStreamWriter,
    StreamStatus,
    BrowserFileStreamReader,
    Thread,
    WriteStats,
} from "openodin";

// These are mime types we show in the client,
// other mime types will be attachemnts.
const MIME_TYPES = {
    "apng":  "image/apng",
    "avif":  "image/avif",
    "png":  "image/png",
    "gif":  "image/gif",
    "jpg":  "image/jpeg",
    "jpeg": "image/jpeg",
    "bmp":  "image/bmp",
    "svg":  "image/svg+xml",
    "tif":  "image/tiff",
    "tiff": "image/tiff",
    "webp": "image/webp",
};

type ObjectURL = ReturnType<typeof URL.createObjectURL>;

export class BlobController {
    public static readonly MAX_BLOB_SIZE = 100 * 1024 * 1024;

    protected handlers: {[name: string]: ( (...args: any) => void)[]} = {};

    protected filename: string;

    protected extension: string;

    protected mimeType: string;

    protected id1: Buffer;

    protected downloadStreamWriter?: StreamWriterInterface;

    protected uploadStreamWriter?: StreamWriterInterface;

    protected objectURL?: ObjectURL;

    protected blobLength: bigint;

    protected throughput: string = "";

    protected downloadError?: string;

    protected uploadError?: string;

    protected syncError?: string;

    protected _isSyncing: boolean = false;

    constructor(protected node: DataInterface, protected service: Service, protected thread: Thread) {
        this.id1 = this.node.getId1()!;

        this.filename = this.node.getData()?.toString() ?? "";

        this.extension = this.filename.toLowerCase().split(".").pop() ?? "";

        this.mimeType = MIME_TYPES[this.extension as keyof typeof MIME_TYPES ] ?? "";

        this.blobLength = this.node.getBlobLength() ?? 0n;
    }

    public isReady(): boolean {
        return this.objectURL !== undefined;
    }

    public getObjectURL(): ObjectURL | undefined {
        return this.objectURL;
    }

    public isImg(): boolean {
        return this.mimeType.startsWith("image/");
    }

    public isDownloading(): boolean {
        return this.downloadStreamWriter !== undefined;
    }

    public isSyncing(): boolean {
        return this._isSyncing;
    }

    public tooLarge(): boolean {
        return this.blobLength > BlobController.MAX_BLOB_SIZE;
    }

    /**
     * @returns download or upload throughput.
     */
    public formatThroughput(stats: WriteStats): string {
        if (stats.finishTime) {
            return "Done";
        }

        const throughput = stats.isPaused ? "Paused" :
            `${Math.floor(stats.throughput / 1024)} kb/s`;

        const percent = Number( (Number(stats.pos) / Number(stats.size) || 0) * 100).toFixed(2);

        return `${percent}% ${throughput}`;
    }

    public getThroughput(): string {
        return this.throughput;
    }

    public cancelDownload() {
        this.downloadStreamWriter?.close();
        delete this.downloadStreamWriter;
        this.downloadError = "cancelled";
    }

    public getDownloadError(): string | undefined {
        return this.downloadError;
    }

    public getSyncError(): string | undefined {
        return this.syncError;
    }

    public isUploading() {
        return this.uploadStreamWriter !== undefined;
    }

    public cancelUpload() {
        this.uploadStreamWriter?.close();
        delete this.uploadStreamWriter;
        this.uploadError = "cancelled";
    }

    public getUploadError(): string | undefined {
        return this.uploadError;
    }

    protected clearErrors() {
        delete this.downloadError;
        delete this.uploadError;
        delete this.syncError;
        this._isSyncing = false;
    }

    public download(syncOnFailure: boolean = true) {
        if (this.downloadStreamWriter) {
            return;
        }

        this.clearErrors();

        const streamReader = this.thread.getBlobStreamReader(this.id1);

        // Download blob into memory.
        //
        this.downloadStreamWriter = new BufferStreamWriter(streamReader);

        this.downloadStreamWriter?.onStats( stats => {
            this.throughput = this.formatThroughput(stats);

            this.update();
        });

        this.update();

        this.downloadStreamWriter.run(0).then( writeData => {
            if (writeData.status === StreamStatus.RESULT) {
                // Create a File object from the filled buffers.
                //
                const file = new File((this.downloadStreamWriter as BufferStreamWriter).getBuffers(),
                    this.filename, { type: this.mimeType });

                this.objectURL = URL.createObjectURL(file);

                delete this.downloadStreamWriter;

                this.update();
            }
            else {
                if (!this.downloadStreamWriter) {
                    // Download was cancelled.
                    //
                    return;
                }

                delete this.downloadStreamWriter;

                if (syncOnFailure) {
                    // Attempt to sync the blob from peers into our local storage.
                    //
                    this.syncBlob();
                }
                else {
                    this.downloadError = "error";
                }

                this.update();
            }
        });
    }

    protected async syncBlob() {
        this._isSyncing = true;

        // hook onBlob event in Service.
        //
        const unhook = this.service.onBlob(this.id1, () => {
            // Now that the blob is available retry the download once.
            //
            this.download(false);
        });

        // The Service will attempt to fetch the blob from all of the connected peers.
        //
        const generator = this.service.syncBlob(this.id1);

        let value = generator.next().value;

        while (value) {
            value.streamWriter.onStats( stats => {
                this.throughput = this.formatThroughput(stats);

                this.update();
            });

            const success = await value.promise;

            if (success) {
                // Success. The hook will be called.
                //
                return;
            }

            value = generator.next().value;
        }

        // No success
        //
        this.syncError = "error";

        unhook();

        this.update();
    }

    public upload(file: File): StreamWriterInterface {
        this.clearErrors();

        const streamReader = new BrowserFileStreamReader(file);

        this.uploadStreamWriter = this.thread.getBlobStreamWriter(this.id1, streamReader);

        this.uploadStreamWriter.onStats( stats => {
            this.throughput = this.formatThroughput(stats);

            this.update();
        });

        this.uploadStreamWriter.run().then( writeData => {
            if (writeData.status === StreamStatus.RESULT) {
                this.objectURL = URL.createObjectURL(file);
            }
            else {
                if (!this.uploadStreamWriter) {
                    // Cancelled
                }
                else {
                    this.uploadError = "error";
                }
            }

            delete this.uploadStreamWriter;

            this.update();
        });

        return this.uploadStreamWriter;
    }

    public purge() {
        if (this.objectURL) {
            URL.revokeObjectURL(this.objectURL);
            delete this.objectURL;
        }
    }

    public onUpdate(cb: () => void): BlobController {
        this.hookEvent("update", cb);
        return this;
    }

    protected update() {
        this.triggerEvent("update");
    }

    protected hookEvent(name: string, callback: ( (...args: any) => void)) {
        const cbs = this.handlers[name] || [];
        this.handlers[name] = cbs;
        cbs.push(callback);
    }

    protected unhookEvent(name: string, callback: ( (...args: any) => void)) {
        const cbs = (this.handlers[name] || []).filter( (cb: ( (...args: any) => void)) => callback !== cb );
        this.handlers[name] = cbs;
    }

    protected triggerEvent(name: string, ...args: any) {
        const cbs = this.handlers[name] || [];
        cbs.forEach( (callback: ( (...args: any) => void)) => {
            setImmediate( () => callback(...args) );
        });
    }
}
