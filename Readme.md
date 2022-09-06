### TON TVM bus 💎 🚌 ✉️
### Multi contract testing framework for TON contracts 
This package provide a simple way to write multi contract using (ton-contract-executor)[https://github.com/Naltox/ton-contract-executor] tests using a bus/registry that connects between contracts .



## Getting Started

Please watch test folder for examples 

-  Jetton example: The Test covers multi contract testing, all jetton's actions: mint, transfer, transfer notification 

### Test local contracts (jetton) 
`/test/jetton.spec.ts` Test Output:
```
	 [0]  ⬅️  From: undefined EQCG-Q....f5DUOI   🛄  Message: Transfer ( 0.3💎 )    ➡️  To: JettonWallet EQChGq....zczGRc
	 [1]  ⬅️  From: JettonWallet EQChGq....zczGRc   🛄  Message: Internal_transfer ( 0.3💎 )    ➡️  To: JettonWallet EQD1XC....S8DWqB
	 [2]  ⬅️  From: JettonWallet EQD1XC....S8DWqB   🛄  Message: Excesses ( 0.28💎 )    ➡️  To: Wallet EQCG-Q....f5DUOI

    ✔ transfer jetton (744ms)
```

### On Chain forking
Fork Contact from main net, and run a swap transaction 

`/test/onchain-contract.spec.ts` Test Output:
```
    [0]  ⬅️  From: undefined EQDjhy....gv8iBr   🛄  Message: x{000000190000000000000001405F5E1006168322CDFD2E} ( 0.19💎 )    ➡️  To: OnChainContract EQBVyE....eO-VCE
	 [1]  ⬅️  From: OnChainContract EQBVyE....eO-VCE   🛄  Message: Transfer ( 0.08💎 )    ➡️  To: OnChainContract EQAAH0....YqJ_Ql
	 [2]  ⬅️  From: OnChainContract EQAAH0....YqJ_Ql   🛄  Message: Internal_transfer ( 0.08💎 )    ➡️  To: OnChainContract EQBYQb....ePp0n4
	 [3]  ⬅️  From: OnChainContract EQBYQb....ePp0n4   🛄  Message: Excesses ( 0.07💎 )    ➡️  To: OnChainContract EQDjhy....gv8iBr

    ✔ Fork Contact from main net, and run a swap transaction (4664ms)
```
