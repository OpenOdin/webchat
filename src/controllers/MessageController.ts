import {
    Service,
    DataInterface,
    Thread,
    ThreadVariables,
    ThreadTemplate,
    BrowserUtil,
    CRDTMessagesAnnotations,
    CRDTViewItem,
} from "openodin";

import {
    BlobController,
} from "./BlobController";

type Reaction = {
    name: string,
    hasReacted: boolean,
    publicKeys: string[],
    count: number,
};

type Reactions = {
    hasMore: boolean,
    list: Reaction[],
};

/**
 * The collected data we have to display a message.
 */
export type Message = {
    isAuthor: boolean,
    text: string,
    publicKey: string,
    id1: string,
    creationTimestamp: string,
    editedText?: string,
    reactions: Reactions,
    blobLength?: bigint,
    blobController?: BlobController,
};

export class MessageController {
    protected channelNode: DataInterface;

    protected handlers: {[name: string]: ( (...args: any) => void)[]} = {};

    /** The limit of messages initially synced from the server. */
    protected limit: number = 24;

    /** License targets. */
    private targets: Buffer[] = [];

    protected thread: Thread;

    constructor(channelNode: DataInterface, protected service: Service,
        threadTemplate: ThreadTemplate,
        threadVariables: ThreadVariables = {}, purgeInterval?: number)
    {
        threadVariables.parentId = channelNode.getId();

        // auto sync is off since we need to fine tailor it and add it our selves.
        //
        this.thread = Thread.fromService(threadTemplate, threadVariables, service, true, /*autoSync=*/false, this.setData, this.unsetData, purgeInterval);

        this.channelNode = channelNode;

        if (MessageController.IsPrivateChannel(channelNode)) {
            this.targets.push(channelNode.getOwner()!);

            const refId = channelNode.getRefId();

            if (refId && !channelNode.getOwner()?.equals(refId)) {
                this.targets.push(refId);
            }
        }
        else {
            // TODO: what kind of permmissions do we want?
        }

        this.thread.onChange( ({appended}) => {
            if (appended.length > 0) {
                this.triggerEvent("notification");
            }

            this.triggerEvent("update");
        });

        this.setAutoSync();
    }

    public close() {
        this.thread.close();
    }

    /**
     * If a channel data node has refId field set this decides that the channel
     * is a private channel between two peers: the owner of the data node and
     * the peer who's public key is set in the refId field of the data node.
     *
     * @params channelNode the node representing the channel
     * @returns true if the channel is private
     */
    public static IsPrivateChannel(channelNode: DataInterface): boolean {
        return (channelNode.getRefId()?.length ?? 0) > 0;
    }

    public isPrivateChannel(): boolean {
        return MessageController.IsPrivateChannel(this.channelNode);
    }

    /**
     * @returns true if publicKey is either owner or refId, or both in case of user.
     */
    public peerOf(publicKey: Buffer): boolean {
        if (this.service.getPublicKey().equals(publicKey)) {
            return (this.channelNode.getOwner()?.equals(publicKey) && this.channelNode.getRefId()?.equals(publicKey)) ?? false;
        }

        return (this.channelNode.getOwner()?.equals(publicKey) || this.channelNode.getRefId()?.equals(publicKey)) ?? false;
    }

    /**
     * Get the name of the channel.
     * If the channel is private the name is the public key of the other peer.
     *
     * @param 
     *
     * @returns name of the channel
     */
    public static GetName(channelNode: DataInterface, publicKey: Buffer): string {
        if (MessageController.IsPrivateChannel(channelNode)) {
            const name = channelNode.getData()?.toString();

            if (name) {
                return name;
            }

            if (channelNode.getRefId()?.equals(publicKey)) {
                return channelNode.getOwner()!.toString("hex");
            }
            else {
                return channelNode.getRefId()!.toString("hex");
            }
        }

        return channelNode.getData()?.toString() ?? "<no name>";
    }

    public getName(): string {
        return  MessageController.GetName(this.channelNode, this.service.getPublicKey());
    }

    /**
     * Set tailored auto sync to Thread.
     */
    protected setAutoSync() {
        // Set the reverse fetch to not have any limit (-1) so to not miss to sync
        // things to the remote peer (push) in cases of being offline.
        //
        this.thread.setAutoSync({limit: this.limit}, {limit: -1});
    }

    public loadHistory() {
        this.limit += 100;

        // Calling this will first remove any sync then add the sync again
        // with the new limit in place.
        //
        this.setAutoSync();
    }

    /**
     * Whenever a new node is added to the view or an existing node is updated
     * this function is called to format the node associated data for our purposes.
     *
     * @param node the node
     * @param message the data object to set (in place) associated with node
     */
    protected setData = (node: DataInterface, message: Message | any) => {
        message.isAuthor            = node.getOwner()!.equals(this.service.getPublicKey());
        message.text                = node.getData()?.toString() ?? "";
        message.publicKey           = node.getOwner()!.toString("hex");
        message.id1                 = node.getId1()!.toString("hex");
        message.creationTimestamp   = new Date(node.getCreationTime()!).toString();
        message.reactions           = message.reactions ?? {hasMore: false, list: []};

        if (node.hasBlob()) {
            if (!message.blobController) {

                // Create the BlobController for downloading.
                //
                message.blobController = new BlobController(node, this.service, this.thread);

                message.blobController.onUpdate( () => this.triggerEvent("update") );

                message.blobLength = node.getBlobLength() ?? 0n;

                if (message.blobLength <= BlobController.MAX_BLOB_SIZE) {
                    message.blobController.download();
                }
            }
        }

        // Handle reactions (likes) and edits of the text.
        // These are technically "annotations" to the node.
        //
        const annotations = node.getAnnotations();

        if (annotations) {
            try {
                const crdtMessageAnnotaions = new CRDTMessagesAnnotations();

                crdtMessageAnnotaions.load(annotations);

                const editNode = crdtMessageAnnotaions.getEditNode();

                if (editNode) {
                    const editedText = editNode.getData()?.toString();

                    message.editedText = editedText;
                }

                const reactions = crdtMessageAnnotaions.getReactions();

                message.reactions.hasMore = reactions.hasMore;

                const names = Object.keys(reactions.reactions);
                names.sort();

                message.reactions.list = names.map( name => {
                    const publicKey = this.service.getPublicKey().toString("hex");
                    const publicKeys = reactions.reactions[name].publicKeys;

                    return {
                        name,
                        hasReacted: publicKeys.includes(publicKey),
                        publicKeys: reactions.reactions[name].publicKeys,
                        count: reactions.reactions[name].count,
                    };
                });
            }
            catch(e) {
                // Fall through.
            }
        }
    }

    /**
     * Automatically called when a Message should be purged to free allocated memory.
     *
     * @param message
     */
    protected unsetData = (id1: Buffer, message: Message | any) => {
        message.blobController?.purge();
    }

    /**
     * @throws on error
     */
    public async sendMessage(text: string) {
        const params: ThreadVariables = {
            // Refer to the last message as refId.
            // This is so the CRDT algorithm can sort the messages.
            refId: this.thread.getStream().getView().getLastItem()?.node.getId1(),

            // The message sent.
            data: Buffer.from(text),

            parentId: this.channelNode.getId(),
        };

        const node = await this.thread.post("message", params);

        if (node.isLicensed()) {
            await this.thread.postLicense("default", node, this.targets);
        }
    }

    public async editMessage(nodeToEdit: DataInterface, messageText: string) {
        const params: ThreadVariables = {
            data: Buffer.from(messageText),
        };

        const node = await this.thread.postEdit("message", nodeToEdit, params);

        if (node.isLicensed()) {
            await this.thread.postLicense("default", node, this.targets);
        }
    }

    public async toggleReaction(message: Message, nodeToReactTo: DataInterface, name: string) {
        const publicKey = this.service.getPublicKey().toString("hex");

        let onoff = "react";

        const reaction = message.reactions.list.find( r => r.name === name );

        if (reaction?.publicKeys.includes(publicKey)) {
            onoff = "unreact";
        }

        const params: ThreadVariables = {
            data: Buffer.from(`${onoff}/${name}`),
        };

        const node = await this.thread.postReaction("message", nodeToReactTo, params);

        if (node.isLicensed()) {
            await this.thread.postLicense("default", node, this.targets);
        }
    }

    public async deleteMessage(messageNode: DataInterface) {
        // First edit the node with an empty string which will effectively hide the node.
        // This is because actual deletion of nodes is not instant, but editing nodes is instant.
        //
        await this.editMessage(messageNode, "");

        // We delay the actual deletion some, just to give the above edit message annotation
        // a chance to spread before the node is removed. If the node is destroyed directly then
        // the above notification cannot get distributed.
        setTimeout( async () => {
            const destroyNodes = await this.thread.delete(messageNode);

            destroyNodes.forEach( async (node) => {
                if (node.isLicensed() && node.getLicenseMinDistance() === 0) {
                    /*const licenses = */await this.thread.postLicense("default", node, this.targets);
                }
            });
        }, 1000);
    }

    public async sendFile(file: File) {
        if (file.size > BlobController.MAX_BLOB_SIZE) {
            alert(`Error: File uploads can be maximum ${BlobController.MAX_BLOB_SIZE} bytes`);
            return;
        }

        const filename = file.name;

        this.triggerEvent("update", {hashing: true});

        const blobHash = await BrowserUtil.HashFileBrowser(file);

        this.triggerEvent("update", {hashing: false});

        const blobLength = BigInt(file.size);

        const node = await this.thread.post("attachment", {
                refId: this.thread.getStream().getView().getLastItem()?.node.getId1(),
                blobHash,
                blobLength,
                data: Buffer.from(filename),
            });

        if (node.isLicensed()) {
            await this.thread.postLicense("default", node, this.targets);
        }

        // Pre-create the message with many missing properties (which is fine).
        //
        const message: any = {};

        // Create the BlobController for uploading.
        //
        message.blobController = new BlobController(node, this.service, this.thread);

        message.blobController.onUpdate( () => this.triggerEvent("update") );

        message.blobController.upload(file);

        // Important to call setData after we have set blobController on the message
        // so it won't attempt a download directly.
        //
        this.thread.getStream().getView().setData(node.getId1()!, message);
    }

    public saveHistory() {
        // Prepare data
        let data = "";

        // Add information disclaimer
        data += "Information notice: this file potentially contains internal, sensitive, restricted and/or confidential information\n";

        // Add license information
        data += "License(s): " + "UNKNOWN" + "\n";

        // Add ruler
        data += "==================================================================================================================\n";

        const items = this.thread.getStream().getView().getItems();
        for(let i=0; i<items.length; i++) {
            const itemData = items[i].data;
            data += itemData.publicKey + "\n";
            data += itemData.creationTimestamp + "\n";
            data += (itemData.editedText ?? itemData.text) + "\n";
            data += "\n";
        }

        const filename = "webchat_" + this.getName() + "_" + (new Date().toISOString().split('T')[0]) + ".txt";

        // Create new resource with data contents
        const file = new File([data], filename, {
            type: "text/plain"
        });

        // Create temporary link element
        const anchorElement = document.createElement("a");
        anchorElement.setAttribute("style", "display: hidden");
        document.body.appendChild(anchorElement);
        anchorElement.href = URL.createObjectURL(file);
        anchorElement.download = filename;

        // Trigger download and cleanup resources
        anchorElement.click();
        URL.revokeObjectURL(anchorElement.href);
        anchorElement.remove();
    }

    public getItems(): CRDTViewItem[] {
        return this.thread.getStream().getView().getItems();
    }

    public onClose(cb: () => void): MessageController {
        this.thread.onClose(cb);
        return this;
    }

    public offClose(cb: () => void) {
        this.thread.offClose(cb);
    }

    public onNotification(cb: () => void): MessageController {
        this.hookEvent("notification", cb);
        return this;
    }

    public offNotification(cb: () => void) {
        this.hookEvent("notification", cb);
    }

    public onUpdate(cb: (obj?: Record<string, any>) => void): MessageController {
        this.hookEvent("update", cb);
        return this;
    }

    public offUpdate(cb: (obj?: Record<string, any>) => void) {
        this.unhookEvent("update", cb);
    }

    protected hookEvent(name: string, callback: ( (...args: any[]) => void)) {
        const cbs = this.handlers[name] || [];
        this.handlers[name] = cbs;
        cbs.push(callback);
    }

    protected unhookEvent(name: string, callback: ( (...args: any[]) => void)) {
        const cbs = (this.handlers[name] || []).filter( (cb: ( (...args: any) => void)) => callback !== cb );
        this.handlers[name] = cbs;
    }

    protected triggerEvent(name: string, ...args: any[]) {
        const cbs = this.handlers[name] || [];
        cbs.forEach( (callback: ( (...args: any[]) => void)) => {
            setImmediate( () => callback(...args) );
        });
    }
}
