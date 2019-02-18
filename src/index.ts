import {MainInstance} from 'enqueuer-plugins-template/main-instance';
import * as subscription from './amqp-subscription';
import * as publisher from './amqp-publisher';

export function entryPoint(mainInstance: MainInstance): void {
    subscription.entryPoint(mainInstance);
    publisher.entryPoint(mainInstance);
}
