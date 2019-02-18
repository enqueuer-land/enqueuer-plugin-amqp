import * as amqp from 'amqp';
import {Subscription} from 'enqueuer/js/subscriptions/subscription';
import {SubscriptionModel} from 'enqueuer/js/models/inputs/subscription-model';
import {Logger} from 'enqueuer/js/loggers/logger';
import {MainInstance} from 'enqueuer/js/plugins/main-instance';
import {SubscriptionProtocol} from 'enqueuer/js/protocols/subscription-protocol';

export class AmqpSubscription extends Subscription {

    private readonly queueName: string;
    private connection: any;
    private messageReceiverPromiseResolver?: (value?: (PromiseLike<any> | any)) => void;

    constructor(subscriptionAttributes: SubscriptionModel) {
        super(subscriptionAttributes);
        this.queueName = subscriptionAttributes.queueName || AmqpSubscription.createQueueName();
    }

    public static createQueueName(): string {
        const queueNameLength = 8;
        const possible: string = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let text = '';

        for (let i = queueNameLength; i > 0; --i) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }

        return text;
    }

    public receiveMessage(): Promise<any> {
        return new Promise((resolve) => {
            Logger.debug(`Amqp subscription registering receiveMessage resolver`);
            this.messageReceiverPromiseResolver = resolve;
        });
    }

    public subscribe(): Promise<void> {
        this.connection = amqp.createConnection(this.options);
        return new Promise((resolve, reject) => {
            this.connection.once('ready', () => {
                this.connectionReady(resolve, reject);
            });
            this.connection.on('error', (err: any) => reject(err));
        });
    }

    public async unsubscribe(): Promise<void> {
        if (this.connection) {
            this.connection.disconnect();
        }
        delete this.connection;
    }

    private connectionReady(resolve: any, reject: any) {
        this.connection.queue(this.queueName, (queue: any) => {
            queue.subscribe((message: any, headers: any, deliveryInfo: any) => this.gotMessage(message, headers, deliveryInfo));
            if (this.exchange && this.routingKey) {
                this.bind(queue, resolve);
            } else if (this.queueName) {
                Logger.debug(`Queue ${this.queueName} bound to the default exchange`);
                resolve();
            } else {
                reject(`Impossible to subscribe: ${this.queueName}:${this.exchange}:${this.routingKey}`);
            }
        });
    }

    private bind(queue: any, resolve: any) {
        Logger.debug(`Amqp subscription binding ${this.queueName} to exchange: ${this.exchange} and routingKey: ${this.routingKey}`);
        queue.bind(this.exchange, this.routingKey, () => {
            Logger.debug(`Queue ${this.queueName} bound`);
            resolve();
        });
    }

    private gotMessage(message: any, headers: any, deliveryInfo: any) {
        if (this.messageReceiverPromiseResolver) {
            const result = {payload: message, headers: headers, deliveryInfo: deliveryInfo};
            this.messageReceiverPromiseResolver(result);
        } else {
            Logger.warning(`Queue ${this.queueName} is not subscribed yet`);
        }
    }

}

export function entryPoint(mainInstance: MainInstance): void {
    const amqp = new SubscriptionProtocol('amqp',
        (subscriptionModel: SubscriptionModel) => new AmqpSubscription(subscriptionModel),
        ['payload', 'headers', 'deliveryInfo'])
        .addAlternativeName('amqp-0.9')
        .setLibrary('amqp') as SubscriptionProtocol;
    mainInstance.protocolManager.addProtocol(amqp);
}
