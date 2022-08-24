import { Address, fromNano } from "ton";
import { expect } from 'chai';

import { printChain } from "../src/message-list";
var data = [
    {
        time: "2022-06-26T07:59:55.052Z",
        from: Address.parse("EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI"),
        inMessage: {
            value: 0,
            body: "x{595F07BC00000000000000015A4A2D938028010DF211ECE5339F60C8FD3C88D120900EEE6DCAA4B741A983ED6E1052892FF21B_}",
            stateInit: "",
            mode: -1,
        },
        contractImpl: {
            name: "x",
            initTime: 1656230395,
            contract: {},
            address: Address.parse("EQDFFzPdq9EPc9Y-aAWZtST0UyVKqPWKDgJ1i_7P9m1NKKR1"),
            initMessageResultRaw: [Object],
        },
        contractAddress: Address.parse("EQDFFzPdq9EPc9Y-aAWZtST0UyVKqPWKDgJ1i_7P9m1NKKR1"),
        exit_code: 0,
        returnValue: undefined,
        logs: [],
        actions: [[Object]],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-26T07:59:55.066Z",
        from: Address.parse("EQDFFzPdq9EPc9Y-aAWZtST0UyVKqPWKDgJ1i_7P9m1NKKR1"),
        inMessage: {
            value: 0,
            body: "x{7BDD97DE00000000000000015A4A2D938028010DF211ECE5339F60C8FD3C88D120900EEE6DCAA4B741A983ED6E1052892FF21B0021BE423D9CA673EC191FA7911A241201DDCDB95496E835307DADC20A5125FE436_}",
            stateInit: "",
            mode: -1,
        },
        contractImpl: {
            name: "x",
            contract: {},
            address: Address.parse("EQBiEB1OVWd6Ovf2JTALSfRpzShtbQbgth-vBeYV9kxvhwcN"),
        },
        contractAddress: Address.parse("EQBiEB1OVWd6Ovf2JTALSfRpzShtbQbgth-vBeYV9kxvhwcN"),
        exit_code: 0,
        returnValue: undefined,
        logs: [],
        actions: [[Object], [Object]],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-26T07:59:55.079Z",
        from: Address.parse("EQBiEB1OVWd6Ovf2JTALSfRpzShtbQbgth-vBeYV9kxvhwcN"),
        inMessage: {
            value: 100000,
            body: "x{0F8A7EA500000000000000015E8D4A510008010DF211ECE5339F60C8FD3C88D120900EEE6DCAA4B741A983ED6E1052892FF21B0021BE423D9CA673EC191FA7911A241201DDCDB95496E835307DADC20A5125FE4341_}",
            stateInit: "",
            mode: -1,
        },
        contractImpl: {
            name: "x",
            initMessageResult: [Object],
            contract: {},
            initMessageResultRaw: [Object],
            address: Address.parse("EQDUKO8nIPHWO6IJhYqh1gpGkExQr1c6K1nW6QE7YhtZoWba"),
        },
        contractAddress: Address.parse("EQDUKO8nIPHWO6IJhYqh1gpGkExQr1c6K1nW6QE7YhtZoWba"),
        exit_code: 0,
        returnValue: undefined,
        logs: [],
        actions: [[Object]],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-26T07:59:55.093Z",
        from: Address.parse("EQDUKO8nIPHWO6IJhYqh1gpGkExQr1c6K1nW6QE7YhtZoWba"),
        inMessage: {
            value: 0xbebc200,
            body: "x{178D451900000000000000015E8D4A51000800C4203A9CAACEF475EFEC4A601693E8D39A50DADA0DC16C3F5E0BCC2BEC98DF0F0021BE423D9CA673EC191FA7911A241201DDCDB95496E835307DADC20A5125FE4342_}",
            stateInit: "",
            mode: -1,
        },
        contractImpl: {
            name: "x",
            initMessageResult: [Object],
            contract: {},
            initMessageResultRaw: [Object],
            address: Address.parse("EQC-pxTsYn8fEf_FeioTHYgIAQmWSaHXo-i8XJg-4MirVN4j"),
        },
        contractAddress: Address.parse("EQC-pxTsYn8fEf_FeioTHYgIAQmWSaHXo-i8XJg-4MirVN4j"),
        exit_code: 0,
        returnValue: undefined,
        logs: [],
        actions: [[Object], [Object]],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-26T07:59:55.096Z",
        from: Address.parse("EQC-pxTsYn8fEf_FeioTHYgIAQmWSaHXo-i8XJg-4MirVN4j"),
        inMessage: {
            value: 0xb532b80,
            body: "x{D53276DB0000000000000001}",
            stateInit: "",
            mode: -1,
        },
        contractImpl: {
            name: "x",
            contract: {},
            address: Address.parse("EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI"),
        },
        contractAddress: Address.parse("EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI"),
        exit_code: 0,
        returnValue: 0xb532b80,
        logs: [],
        actions: [],
        isDeployedByAction: false,
    },
    {
        time: "2022-06-26T07:59:55.097Z",
        from: Address.parse("EQBiEB1OVWd6Ovf2JTALSfRpzShtbQbgth-vBeYV9kxvhwcN"),
        inMessage: { value: 0, body: "x{}", stateInit: "", mode: -1 },
        contractImpl: {
            name: "x",
            contract: {},
            address: Address.parse("EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI"),
        },
        contractAddress: Address.parse("EQCG-Qj2cpnPsGR-nkRokEgHdzblUlug1MH2twgpRJf5DUOI"),
        exit_code: 0,
        returnValue: 0xbebc200,
        logs: [],
        actions: [],
        isDeployedByAction: false,
    },
];

describe("print chain", () => {
    it("print chain data", () => {
        expect(data.length).to.be.eq(6)
    });
});
