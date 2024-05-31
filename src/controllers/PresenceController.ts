import {
    Hash,
    Thread,
    ThreadFetchParams,
    ThreadTemplate,
    Service,
    NodeInterface,
    CRDTViewItem,
} from "openodin";

export type PresenceItem = {
    publicKey: Buffer,
    creationTime: number,
    displayName: string,
    isActive: boolean,
};

export type PresenceState = {
    /** Last user activity detected (mouse move, etc). */
    lastActivityDetected: number,

    /** True if local user is active. */
    isActive: boolean,

    /** Quick lookup checking active users. */
    active: {[publicKey: string]: true},

    /** List of public keys of active users. */
    activeList: PresenceItem[],

    /** List of public keys of inactive users. */
    inactiveList: PresenceItem[],

    presence: {[publicKey: string]: PresenceItem},
};

// Users show as inactive after this threshold, about.
//
const INACTIVE_THRESHOLD = 1 * 60 * 1000;  // one minute

export class PresenceController {
    protected pulseTimer?: ReturnType<typeof setTimeout>;

    protected refreshTimer?: ReturnType<typeof setTimeout>;

    protected state: PresenceState;

    protected thread: Thread;

    protected handlers: {[name: string]: ( (...args: any) => void)[]} = {};

    constructor(service: Service, threadTemplate: ThreadTemplate,
        threadFetchParams: ThreadFetchParams = {})
    {
        this.thread = Thread.fromService(threadTemplate, threadFetchParams, service, true, true);

        this.state = {
            lastActivityDetected: 0,
            isActive: false,
            active: {},
            activeList: [],
            inactiveList: [],
            presence: {},
        };

        this.thread.onChange( ({added}) => this.handleOnChange(added) );

        this.refreshTimer = setTimeout(() => this.refreshPresence(), INACTIVE_THRESHOLD / 4);

        this.pulseTimer = setTimeout( () => this.postPresence(), INACTIVE_THRESHOLD);

        this.thread.post("existence");
    }

    public getItems(): CRDTViewItem[] {
        return this.thread.getStream().getView().getItems();
    }

    /**
     * Repeatadly post a presence node on an interval,
     * if the presence is active.
     *
     * @param force set to true to force send a presence node
     */
    protected postPresence(force: boolean = false) {
        // Clear in case is called outside setTimeout.
        //
        clearTimeout(this.pulseTimer);

        this.pulseTimer = undefined;

        if (this.isActive() || force) {
            this.thread.post("presence");
        }

        this.pulseTimer = setTimeout( () => this.postPresence(), INACTIVE_THRESHOLD);
    }

    /**
     * Called from the outside whenever activity is detected.
     * If current state is inactive then immediately send a presence node.
     */
    public activityDetected() {
        this.state.lastActivityDetected = Date.now();

        if (!this.isActive()) {
            this.state.isActive = true;

            this.triggerEvent("active");

            this.postPresence(true);
        }
    }

    public isActive(): boolean {
        return this.state.isActive;
    }

    public onUpdate(cb: () => void): PresenceController {
        this.hookEvent("update", cb);
        return this;
    }

    public offUpdate(cb: () => void) {
        this.unhookEvent("update", cb);
    }

    public onActive(cb: () => void): PresenceController {
        this.hookEvent("active", cb);
        return this;
    }

    public offActive(cb: () => void) {
        this.unhookEvent("active", cb);
    }

    public onInactive(cb: () => void): PresenceController {
        this.hookEvent("inactive", cb);
        return this;
    }

    public offInactive(cb: () => void) {
        this.unhookEvent("inactive", cb);
    }

    public onClose(cb: () => void): PresenceController {
        this.thread.onClose(cb);
        return this;
    }

    public offClose(cb: () => void) {
        this.thread.offClose(cb);
    }

    /**
     * @returns list of public keys of active users.
     */
    public getActiveList(): PresenceItem[] {
        return this.state.activeList;
    }

    public getList(): PresenceItem[] {
        // TODO: this needs some types of smart sorting.
        //
        return Object.values(this.state.presence);
    }

    /**
     * @returns list of public keys of inactive users.
     */
    public getInactiveList(): PresenceItem[] {
        return this.state.inactiveList;
    }

    /**
     * Check if given public key is active.
     *
     * @param publicKey is hex-string for convenience in UI.
     */
    public isPresent(publicKeyStr: string): boolean {
        return this.state.active[publicKeyStr];
    }

    /**
     * In this controller it makes more sense to hook the onChange event rather than implementing the
     * setData() function since we are using a special struct which is not per node.
     */
    protected handleOnChange(added: CRDTViewItem[]) {
        added.forEach( crdtItem => {
            const node = crdtItem.node;

            const publicKey = node?.getOwner();

            if (!node || !publicKey) {
                return;
            }

            const publicKeyStr = publicKey.toString("hex");

            const item = this.state.presence[publicKeyStr];
            const creationTime = node.getCreationTime() ?? 0;

            if (!item || item.creationTime < creationTime) {
                this.state.presence[publicKeyStr] = {
                    publicKey,
                    creationTime,
                    displayName: publicKey.toString("hex"),
                    isActive: false,
                };
            }
        });

        if (added.length > 0) {
            this.refreshPresence();
        }
    }

    protected refreshPresence = () => {
        // Check if user is going inactive.
        //
        if (this.isActive()) {
            if (Date.now() - this.state.lastActivityDetected >= INACTIVE_THRESHOLD) {
                this.state.isActive = false;

                this.triggerEvent("inactive");
            }
        }

        this.state.active = {};
        this.state.activeList = [];
        this.state.inactiveList = [];

        for (const publicKeyStr in this.state.presence) {
            const item = this.state.presence[publicKeyStr];

            const diff = Date.now() - item.creationTime;

            if (diff < INACTIVE_THRESHOLD * 1.5) {
                item.isActive = true;
                this.state.active[publicKeyStr] = true;
                this.state.activeList.push(item);
            }
            else {
                item.isActive = false;
                this.state.inactiveList.push(item);
            }
        }

        // Sort on public key
        //
        this.state.activeList.sort( (a, b) => a.publicKey.compare(b.publicKey) );

        // Sort on creationTime descending
        //
        this.state.inactiveList.sort( (a, b) => b.creationTime - a.creationTime );

        this.triggerEvent("update");
    }

    public close() {
        this.thread.close();

        clearTimeout(this.refreshTimer);

        clearTimeout(this.pulseTimer);
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
