import * as subscription from './amqp-subscription';
import * as publisher from './amqp-publisher';
import {MainInstance} from 'enqueuer';

export function entryPoint(mainInstance: MainInstance): void {
    subscription.entryPoint(mainInstance);
    publisher.entryPoint(mainInstance);
}
