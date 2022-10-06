import { Address, Cell, contractAddress, InternalMessage, TonClient } from "ton";
import { SendMsgAction } from "ton-contract-executor";
import { actionToMessage } from "../src/utils";
import { OnChainContract } from "./onChainContract";
import { ParsedExecutionResult, ExecutionResult, iTvmBusContract, iDeployableContract } from "./types";
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
        // console.log(`${address.toFriendly()}`, contract);

        //  contract doesn't exists in pool and forkNetwork flag is on, fetch
        //  contract dynamically
        if (!contract && this.forkNetwork) {
            let c = await OnChainContract.Create(this.forkNetwork.client, address, this);
            if (c) {
                contract = c;
            } else {
                // TODO
                throw "OnChainContract Create failed";
            }
        }
        return contract;
    }

    registerCode(contract: iDeployableContract) {
        const codeCell = contract.getCodeCell()[0];
        this.codeToContractPool.set(codeCell.hash().toString("hex"), contract);
    }

    findContractByCode(codeCell: Cell) {
        return this.codeToContractPool.get(codeCell.hash().toString("hex"));
    }

    registerContract(contract: iTvmBusContract) {
        const address = contract.address as Address;
        this.pool.set(address.toFriendly(), contract);
    }

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

        const task = queue.pop() as Function;

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

    private async _broadcast(msg: InternalMessage, taskQueue: Array<Function>) {
        //console.log(`broadcastCounter: ${this.counters.messagesSent} msg.body `, msg.body, `dest ${msg.to.toFriendly()}`);

        let receiver = await this.getContractByAddress(msg.to);

        // in case receiver is not registered and the code is registered we can initialize the contract by the message
        if (!receiver) {
            // if fork Network flag is on, Create a contract based on RPC client
            console.log(`receiver not found: ${msg.to.toFriendly()} msg.body:${msg.body}`);
            //throw "no registered receiver";
            return { taskQueue };
        }
        // process one message on each recursion
        const response = await receiver.sendInternalMessage(msg);

        this.results.push(parseResponse(msg, response, receiver, false, "broadcast"));
        //@ts-ignore

        if (response.actions) {
            //@ts-ignore
            response.actionList = response.actions;
        }
        this.counters.messagesSent++;
        if (response.actionList) {
            // queue all other message action`s

            for (let it of response.actionList) {
                if (it.type != "send_msg") {
                    //console.log(it.type);
                    continue;
                }

                let itMsg = actionToMessage(msg.to, it, msg, response);

                taskQueue.push(async () => {
                    it = it as SendMsgAction;
                    //console.log(`task -> to:${itMsg.to.toFriendly()} body: ${itMsg.body.body}`);

                    // In case message has StateInit, and contract address is not registered
                    if (it.message.init && !(await this.getContractByAddress(itMsg.to))) {
                        const deployedContract = (await this.deployContractFromMessage(
                            it.message?.init?.code as Cell,
                            it.message?.init?.data as Cell,
                            itMsg,
                        )) as iTvmBusContract;

                        this.counters.contractDeployed++;

                        const parsedResult = parseResponse(
                            itMsg,
                            deployedContract.initMessageResultRaw as ExecutionResult,
                            deployedContract,
                            true,
                            "loop",
                        );

                        for (let action of parsedResult.actions) {
                            // TODO reserve currency
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
                    } else {
                        return this._broadcast(itMsg, taskQueue);
                    }
                });
            }
        }
        return {
            results: this.results,
            taskQueue,
        };
    }

    async deployContractFromMessage(codeCell: Cell, storage: Cell, message: InternalMessage) {
        const address = await contractAddress({ workchain: 0, initialCode: codeCell, initialData: storage });
        if (this.pool.has(address.toFriendly())) {
            throw "deployContractFromMessage failed, already exsits";
            return;
        }
        let impl = this.findContractByCode(codeCell);
        if (!impl) {
            console.table(this.codeToContractPool);
            console.log(codeCell.hash());

            throw "Please register contracts";
        }

        let contract = await impl.createFromMessage(codeCell, storage, message, this);
        this.registerContract(contract);

        return contract;
    }
}
