import { Address, fromNano } from "ton";

interface StringArray {
    [index: string]: any;
}

function enrich(data: any) {
    const enriched = data.map((it: any, i: number) => {
        // it.from = it.from;
        // it.contractAddress = it.contractAddress;
        it.index = i;
        if (i == 0) {
            return it;
        }
        it.prev = data[i - 1];
        it.sender = findNearestSender(data, i, it.from);

        if (it.sender) {
            // throw "no sender";
        } else {
            console.log(`couldn't find sender ${it.from.toFriendly()}`);

            // throw "sender not found"
        }
        return it;
    });

    return enriched;
}

function findNearestSender(data: any, index: number, address: Address) {
    for (let i = index; i >= 0; i--) {
        if (data[i].contractAddress?.toFriendly() == address.toFriendly()) {
            return data[i];
        }
    }
    console.log(`findNearestSender : not found ${address.toFriendly()}`);

    return null;
}

function dataToTree(data: any) {
    let result: StringArray = {};
    data.forEach((it: object, i: number) => {
        //genesis
        if (i == 0) {
            //@ts-ignore
            it.index = 0;
            return (result["0"] = it);
        }

        // previous message is the sender
        // @ts-ignore
        if (it.prev.contractAddress == it.from) {
            //@ts-ignore
            const key = `${it.from.toFriendly()}-${it.prev.index}`;
            result[key] = result[key] || [];
            result[key].push(it);
        } else {
            // @ts-ignore
            if (!it.sender) {
                // TODO:: needs to be fixed initial sender should be part of the chain
                console.log(`messageList::sender_not_found`);
                return;
            }
            // @ts-ignore
            const key = `${it.sender.contractAddress.toFriendly()}-${it.sender.index}`;
            result[key] = result[key] || [];
            result[key].push(it);
        }
        // @ts-ignore
        // console.log(i, "it.prev.prev.contractAddress", it.prev.prev?.contractAddress);
    });
    return result;
}

// tree
// key address-Index

function treeToChains(data: StringArray) {
    let chains: StringArray = {};

    for (let key in data) {
        // genesis message
        if (key == "0") {
            chains["0"] = [data[key]];
            continue;
        }
        let arr = data[key];
        for (let j = 0; j < arr.length; j++) {
            const message = arr[j];

            const senderKey = messageToKey(message.sender); // go to previous message and extract key to find chains tail
            const chainKey = findChainByTail(chains, senderKey);

            if (chainKey) {
                chains[chainKey].push(message);
            } else {
                // create a new chain with key of the current message
                chains[messageToKey(message)] = [message];
            }
        }
    }
    return chains;
}

function findMessageSender(message: any) {
    if (message.prev.contractAddress == message.from) {
        return message.prev;
    } else {
        if (!message.prev.prev) {
            throw "raw chain messages is broken ! ";
        }
        return message.prev.prev;
    }
}

function findChainByTail(chains: StringArray, newMessageSenderKey: string) {
    for (let key in chains) {
        const chain = chains[key];

        let tailKey = messageToKey(chain[chain.length - 1]);
        // console.log(`tailKey: ${tailKey} == ${newMessageSenderKey}`);

        if (tailKey == newMessageSenderKey) {
            return key;
        }
    }
    // no chains found

    return "";
}

function messageToKey(message: any) {
    return `${message.contractAddress.toFriendly()}-${message.index}`;
}

export function printChain(data: any, header = "-=== Print Chain ===- ") {
    const richData = enrich(data);
    const result = dataToTree(richData);
    const chains = treeToChains(result);
    print(chains, header);
    return chains;
}

function print(data: any, header = "") {
    let buffer = `${header}`;
    let keyIndent = 0;

    for (let key in data) {
        keyIndent++;
        buffer += `\n==[${addressEllipsis(key)}]==> \n`;
        let arr = data[key];

        for (let j = 0; j < arr.length; j++) {
            if (j == 0 && arr[j].sender) {
                buffer += `Origin: ${addressEllipsis(arr[j].sender.contractAddress.toFriendly())}-${
                    arr[j].sender.index
                }\n`;
            }

            const coins = fromNano(arr[j].inMessage.value);
            const indentation = indentByIndex(keyIndent);
            buffer += `
${indentation} [${arr[j].index}]  ⬅️  From: ${arr[j].sender?.contractImpl?.constructor.name} ${addressEllipsis(
                arr[j].from,
            )}   🛄  Message: ${messageOpToName(arr[j])} ( ${coins}💎 )    ➡️  To: ${
                arr[j].contractImpl?.constructor.name
            } ${addressEllipsis(arr[j].contractAddress)}`.padEnd(100);
        }
        buffer += `\n`;
    }
    console.log(buffer);
}

function indentByIndex(i: number) {
    let res = "";
    for (let j = 0; j < i; j++) {
        res += "\t";
    }
    return res;
}

function addressEllipsis(address: string) {
    if (!address) {
        return `...`;
    }

    if (typeof address == "object") {
        // @ts-ignore
        address = address.toFriendly();
    }

    return `${address.substring(0, 6)}....${address.substring(42, 48)}`;
}

function messageOpToName(message: any) {
    const opsDict: StringArray = {
        "0x0f8a7ea5": "Transfer",
        "0x7362d09c": "Transfer_notification",
        "0x178d4519": "Internal_transfer",
        "0xd53276db": "Excesses",
        "0x595f07bc": "Burn",
        "0x7bdd97de": "Burn_notification",
        "22": "ADD_LIQUIDITY",
        "23": "REMOVE_LIQUIDITY",
        "24": "SWAP_TOKEN",
        "25": "SWAP_TON",
        "21": "MINT",
    };
    let messageBody = message.inMessage?.body;
    messageBody = messageBody.replace("x{} ", ""); // TODO why is it happening?
    let val = `0x${message.inMessage?.body.substring(2, 10)}`.toLowerCase();

    return opsDict[val] ? opsDict[val] : message.inMessage?.body;
}

//printChain(data);

// A -> B -> C
//        -> D -> F
//        -> E -> G
