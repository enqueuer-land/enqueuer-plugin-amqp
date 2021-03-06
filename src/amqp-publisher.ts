import * as amqp from 'amqp';
import {Publisher, InputPublisherModel, Logger, MainInstance, PublisherProtocol} from 'enqueuer';

export class AmqpPublisher extends Publisher {
    private connection: any;

    constructor(publisher: InputPublisherModel) {
        super(publisher);
        this['messageOptions'] = publisher.messageOptions || {};
        this['exchangeOptions'] = publisher.exchangeOptions || {};
        this.exchangeOptions.confirm = true;
        if (this.exchangeOptions.passive === undefined) {
            this.exchangeOptions.passive = true;
        }
    }

    public publish(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.connection = amqp.createConnection(this.options);
            this.connection.once('ready', () => {
                const exchange = this.getExchange();
                Logger.debug(`Exchange to publish: '${this.exchange || 'default'}' created`);
                exchange.once('open', () => {
                    this.exchangeOpen(exchange, reject, resolve);
                });
            });
            this.connection.on('error', (err: any) => {
                return reject(err);
            });
        });
    }

    private getExchange() {
        return this.connection.exchange(this.exchange || '', this.exchangeOptions);
    }

    private exchangeOpen(exchange: any, reject: any, resolve: any) {
        Logger.debug(`Exchange '${this.exchange || 'default'}' is opened, publishing to routingKey ${this.routingKey}`);
        exchange.publish(this.routingKey, this.payload, this.messageOptions, (errored: any, err: any) => {
            Logger.trace(`Exchange published callback`);
            this.connection.disconnect();
            this.connection.end();
            if (errored) {
                return reject(err);
            }
            Logger.trace(`AMQP message published`);
            this.executeHookEvent('onPublished');
            resolve();
        });
    }
}

export function entryPoint(mainInstance: MainInstance): void {
    const amqp = new PublisherProtocol('amqp',
        (publisherModel: InputPublisherModel) => new AmqpPublisher(publisherModel),
        {
            homepage: 'https://github.com/enqueuer-land/enqueuer-plugin-amqp',
            libraryHomepage: 'https://github.com/postwait/node-amqp',
            description: 'Publisher to handle AMQP 0.9 protocol',
            schema: {
                attributes: {
                    options: {
                        description: 'Connection options',
                        type: 'object',
                        required: false,
                    },
                    exchangeOptions: {
                        type: 'object',
                        required: false,
                    },
                    exchange: {
                        description: 'Defaults to the default exchange when empty',
                        type: 'string',
                        required: false
                    },
                    routingKey: {
                        type: 'string',
                        required: true
                    },
                },
                hooks: {
                    onPublished: {
                        arguments: {}
                    }
                }
            }
        })
        .addAlternativeName('amqp-0.9')
        .setLibrary('amqp') as PublisherProtocol;
    mainInstance.protocolManager.addProtocol(amqp);
}
