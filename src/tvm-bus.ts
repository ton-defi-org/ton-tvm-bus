import { Address, Cell, contractAddress, ExternalMessage, InternalMessage, StateInit, TonClient } from "ton";
import { SendMsgAction } from "ton-contract-executor";
import { actionToMessage } from "../src/utils";
import { GenericContract } from "./genericContract";
import { OnChainContract } from "./onChainContract";
import {
    ParsedExecutionResult,
    ExecutionResult,
    iTvmBusContract,
    iDeployableContract,
    ExecutionResultWithFees,
} from "./types";
import { parseResponse } from "./utils";

export class TvmBus {
    constructor(private forkNetwork?: { client: TonClient }) {}
    counters = {
        messagesSent: 0,
        contractDeployed: 0,
    };

    pool = new Map<string, iTvmBusContract>();
    codeToContractPool = new Map<string, iDeployableContract>();
    results = Array<ParsedExecutionResult>();

    async getContractByAddress(address: Address) {
        let contract = this.pool.get(address.toFriendly()) as iTvmBusContract;

        //  contract doesn't exists in pool and forkNetwork flag is on, fetch
        //  contract dynamically
        if (!contract && this.forkNetwork) {
            let contractFromNetwork = await OnChainContract.Create(this.forkNetwork.client, address, this);
            if (contractFromNetwork) {
                contract = contractFromNetwork;
                this.registerContract(contractFromNetwork);
            } else {
                // maybe message has state Init
                return null;
            }
        }
        return contract;
    }

    registerCode(contract: iDeployableContract) {
        const codeCell = contract.getCodeCell();
        this.codeToContractPool.set(codeCell.hash().toString("hex"), contract);
    }

    findContractByCode(codeCell: Cell) {
        return this.codeToContractPool.get(codeCell.hash().toString("hex"));
    }

    registerContract(contract: iTvmBusContract) {
        const address = contract.address as Address;
        this.pool.set(address.toFriendly(), contract);
    }

    //    async broadcastExternal(msg: ExternalMessage) {}

    async broadcast(msg: InternalMessage) {
        // empty results queue
        this.results = Array<ParsedExecutionResult>();

        let { taskQueue } = await this._broadcast(msg, Array<Function>());
        return await this.iterateTasks(taskQueue);
    }

    async iterateTasks(queue: Array<Function>) {
        if (queue.length == 0) {
            return this.results;
        }

        const task = queue.pop();

        if (!task) {
            throw "xxx"; //TODO ... not possible
        }

        let { taskQueue } = await task();
        if (taskQueue.length == 0) {
            return this.results;
        }
        await this.iterateTasks(taskQueue);
        return this.results;
    }

    private async _broadcast(message: InternalMessage, taskQueue: Array<Function>) {
        //console.log(`broadcastCounter: ${this.counters.messagesSent} msg.body `, msg.body, `dest ${msg.to.toFriendly()}`);

        // assuming 1st message in the queue , so add the first sender as the initial contract in the chain
        // if (taskQueue.length == 0) {
        //     await this.getContractByAddress(msg.from as Address);
        // }

        let receiver = await this.getContractByAddress(message.to);

        // in case receiver is not registered and the code is registered we can initialize the contract by the message as a generic contract
        if (!receiver) {
            if (message.body.stateInit) {
                receiver = await this.initGenericContract(message, false);
            } else {
                console.log(`receiver not found: ${message.to.toFriendly()}`, message);
                return { taskQueue };
            }
        }
        // process one message on each recursion
        const response = await receiver.sendInternalMessage(message);

        this.results.push(parseResponse(message, response, receiver, false, "broadcast"));

        // if (response.actions) {
        //     //@ts-ignore
        //     response.actionList = response.actions;
        // }
        this.counters.messagesSent++;
        if (response.actionList) {
            // queue all other message action`s

            for (let action of response.actionList) {
                if (action.type != "send_msg") {
                    //console.log(it.type);
                    continue;
                }

                let actionMessage = actionToMessage(message.to, action, message, response);

                taskQueue.push(async () => {
                    action = action as SendMsgAction;
                    //console.log(`task -> to:${itMsg.to.toFriendly()} body: ${itMsg.body.body}`);

                    // In case message has StateInit, and contract address is not registered
                    if (action.message.init && !(await this.getContractByAddress(actionMessage.to))) {
                        return this.handelMessageWithStateInit(actionMessage, action, taskQueue, message, response);
                    } else {
                        return this._broadcast(actionMessage, taskQueue);
                    }
                });
            }
        }
        return {
            results: this.results,
            taskQueue,
        };
    }

    // This method creates a new tvmBusContract from the state-init
    // processing the message (not the sate init) is prcoess by _broadcast logic
    async initGenericContract(msg: InternalMessage, processMessageAfterInit = false) {
        if (!msg.body?.stateInit) {
            throw "stateInit cant be null";
        }
        console.log(msg.body?.stateInit);

        let receiver = await GenericContract.Create(
            this,
            (msg.body?.stateInit as StateInit).code!,
            (msg.body?.stateInit as StateInit).data!,
            msg,
            msg.value,
            processMessageAfterInit,
        );
        this.registerContract(receiver);
        this.counters.contractDeployed++;
        return receiver;
    }

    async handelMessageWithStateInit(
        sourceMessage: InternalMessage,
        it: SendMsgAction,
        taskQueue: Function[],
        msg: InternalMessage,
        response: ExecutionResult,
    ) {
        const deployedContract = (await this.deployContractFromMessage(
            it.message?.init?.code as Cell,
            it.message?.init?.data as Cell,
            it,
            sourceMessage,
            response,
        )) as iTvmBusContract;

        this.counters.contractDeployed++;

        const parsedResult = parseResponse(
            sourceMessage,
            deployedContract.initMessageResultRaw as ExecutionResultWithFees,
            deployedContract,
            true,
            "loop",
        );

        for (let action of parsedResult.actions) {
            // TODO: reserve currency
            if (action.type != "send_msg") {
                console.log(`unsupported action.type ${action.type}`);
                continue;
            }
            taskQueue.push(async () => {
                return await this._broadcast(
                    actionToMessage(deployedContract.address as Address, action, msg, response),
                    taskQueue,
                );
            });
        }
        return {
            results: this.results.push(parsedResult),
            taskQueue,
        };
    }

    async deployContractFromMessage(
        codeCell: Cell,
        storage: Cell,
        messageAction: SendMsgAction,
        message: InternalMessage,
        response: ExecutionResult,
    ): Promise<iTvmBusContract> {
        const futureAddress = await contractAddress({ workchain: 0, initialCode: codeCell, initialData: storage });

        if (this.pool.has(futureAddress.toFriendly())) {
            // if contract exists, already deployed
            return this.pool.get(futureAddress.toFriendly()) as iTvmBusContract;
        }

        let impl = this.findContractByCode(codeCell);
        if (!impl) {
            // console.table(this.codeToContractPool);
            console.log(codeCell.hash().toString("base64"));

            //throw `couldn't find contract ${address.toFriendly()} Please register contracts by code hash `;

            // In case code hash is not registerd , use generic contract

            const internalMsg = actionToMessage(message.from!, messageAction, message, response);
            console.log(`deployContractFromMessage`, internalMsg);

            return this.initGenericContract(internalMsg, true);
        }

        let contract = await impl.createFromMessage(codeCell, storage, message, this);
        this.registerContract(contract);

        return contract;
    }
}
