import {
    Service,
    ThreadController,
    ThreadTemplate,
    ThreadFetchParams,
    DataInterface,
} from "openodin";

import {
    MessageController,
} from "./MessageController";

export type Channel = {
    /**
     * This is set to true if the channel is regarded private.
     * A private channel is identified as having its refId field set.
     */
    isPrivate: boolean,

    /**
     * The name of the channel.
     * For private channels this is ignored and the public key of the peer is the name.
     */
    name: string,

    /**
     * The active channel is the one showing in the UI and the
     * one the user is interacting with.
     *
     * Only one channel can be active at a time.
     */
    isActive: boolean,

    /**
     * Flag set when there is a new message in an inactive channel.
     */
    hasNotification: boolean,

    /** When the channel is opened the controller is created and set. */
    controller?: MessageController,

    id1: Buffer,
};

export class ChannelListController extends ThreadController {
    protected messageThreadTemplate: ThreadTemplate;

    constructor(service: Service, threadTemplate: ThreadTemplate,
        messageThreadTemplate: ThreadTemplate,
        threadFetchParams: ThreadFetchParams = {})
    {
        super(service, threadTemplate, threadFetchParams);

        this.messageThreadTemplate = messageThreadTemplate;

        this.onChange( () => this.update() );
    }

    /**
     * Whenever a new node is added to the view or an existing node is updated
     * this function is called to format the node associated data for our purposes.
     *
     * @param channelNode the channelNode
     * @param message the data object to set (in place) associated with node
     */
    protected makeData(channelNode: DataInterface, channel: Channel) {
        channel.isPrivate       = MessageController.IsPrivateChannel(channelNode);
        channel.name            = MessageController.GetName(channelNode, this.getPublicKey());
        channel.isActive        = false;
        channel.hasNotification = false;
        channel.id1             = channelNode.getId1()!;
    }

    /**
     * Get or create the MessageController for a given channel node and set it in the Channel struct.
     *
     * @param channelNodeId1 the id1 of the node representing the channel
     * @returns the message controller for the channel
     */
    public openChannel(channelNodeId1: Buffer): MessageController {
        const item = this.findItem(channelNodeId1);

        if (!item) {
            throw new Error("Could not create controller for non existing channel");
        }

        const channel = item.data as Channel;

        const channelNode = item.node;

        let messageController = channel.controller;

        if (!messageController) {
            messageController = new MessageController(channelNode, this.service,
                this.messageThreadTemplate);

            messageController.onNotification( () => {
                if (channel.isActive === false) {
                    channel.hasNotification = true;

                    this.update();
                }
            });

            messageController.onClose( () => {
                channel.isActive = false;
                delete channel.controller;
            });

            channel.controller = messageController;
        }

        return messageController;
    }

    /**
     * Set chosen channel isActive flag to true and all other
     * channels to isActive flag to false.
     *
     * This is to signal to the outside which channel to display.
     *
     * @param channelNodeId1 id1 of the channel to set as active.
     */
    public setChannelActive(channelNodeId1: Buffer) {
        this.getItems().forEach( item => {
            const channel = item.data as Channel;

            if (item.id1.equals(channelNodeId1)) {
                channel.isActive = true;
                channel.hasNotification = false;
            }
            else {
                channel.isActive = false;
            }
        });
    }

    /**
     * @returns the controller of the channel which is active, if any.
     */
    public getActiveController(): MessageController | undefined {
        // TODO: keep indexed for quicker retrievel
        //
        const items = this.getItems();

        const itemsLength = items.length;
        for (let i=0; i<itemsLength; i++) {
            const item = items[i];

            const channel = item.data as Channel;
            if (channel.isActive) {
                return channel.controller;
            }
        }

        return undefined;
    }

    /**
     * Check if channel has pending notifications.
     * @param channelNodeId1 the id1 of the channel.
     */
    public hasNotification(channelNodeId1: Buffer): boolean {
        const item = this.findItem(channelNodeId1);

        if (item) {
            const channel = item.data as Channel;

            return channel.hasNotification;
        }

        return false;
    }

    /**
     * Make a private channel node between two peers, unless one already exists then return it.
     *
     * @returns node of the private channel
     * @throws if channel node cannot be created.
     */
    public async makePrivateChannel(friendPublicKey: Buffer, name: string):
        Promise<DataInterface | undefined>
    {
        // See if there already is a private chat for us and the user.
        //
        const ourPublicKey = this.getPublicKey();

        if (!name) {
            return;
        }

        const items = this.getItems();

        const itemsLength = items.length;

        for (let i=0; i<itemsLength; i++) {
            const item = items[i];

            const node = item.node;

            let exists = false;

            if (node.getOwner()?.equals(ourPublicKey)) {
                if (node.getRefId()?.equals(friendPublicKey)) {
                    // Channel exists.
                    //
                    exists = true;
                }
            }
            else if (node.getOwner()?.equals(friendPublicKey)) {
                if (node.getRefId()?.equals(ourPublicKey)) {
                    // Channel exists.
                    //
                    exists = true;
                }
            }

            if (exists) {
                if (node.getData()?.toString() === name) {
                    return node;
                }
            }
        }

        // Channel does not exist.
        //
        const node = await this.thread.post("channel", {
            refId: friendPublicKey,
            data: Buffer.from(name),
        });

        if (node.isLicensed()) {
            await this.thread.postLicense("channel", node, {
                targets: friendPublicKey.equals(ourPublicKey) ? [ourPublicKey] :
                    [friendPublicKey, ourPublicKey],
            });
        }

        return node;
    }

    public hasUserNotification(publicKey: Buffer): boolean {
        const channels = this.getPrivateChannels(publicKey);

        const channelsLength = channels.length;
        for (let i=0; i<channelsLength; i++) {
            const channel = channels[i];
            if (channel.hasNotification) {
                return true;
            }
        }

        return false;
    }

    public peerOfActive(publicKey: Buffer) {
        const messageController = this.getActiveController();

        if (messageController?.isPrivateChannel()) {
            return messageController.peerOf(publicKey);
        }

        return false;
    }

    /**
     * Get list of non-private channels.
     */
    public getChannels(publicKey: Buffer): Channel[] {
        // TODO: optimize
        //

        const channels: Channel[] = [];

        const items = this.getItems();

        const itemsLength = items.length;
        for (let i=0; i<itemsLength; i++) {
            const item = items[i];

            const channel = item.data as Channel;

            if (!channel.isPrivate) {
                channels.push(channel);
            }
        }

        return channels;
    }

    /**
     * Get list of private channels for which peer publicKey is participant.
     */
    public getPrivateChannels(publicKey: Buffer): Channel[] {
        // TODO optimize this with indexes
        //

        const channels: Channel[] = [];

        const items = this.getItems();

        const isSelf = this.service.getPublicKey().equals(publicKey);

        const itemsLength = items.length;
        for (let i=0; i<itemsLength; i++) {
            const item = items[i];

            const channel = item.data as Channel;

            if (isSelf && item.node.getOwner()?.equals(publicKey) &&
                item.node.getRefId()?.equals(publicKey))
            {
                channels.push(channel);
            }
            else if (!isSelf && (item.node.getOwner()?.equals(publicKey) ||
                item.node.getRefId()?.equals(publicKey)))
            {
                channels.push(channel);
            }
        }

        return channels;
    }
}
