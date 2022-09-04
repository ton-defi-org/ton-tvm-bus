### Multi contract testing framework for TON contracts 
This package provide a simple way to write multi contract using (ton-contract-executor)[https://github.com/Naltox/ton-contract-executor] tests using a bus/registry that connects between contracts .



## Getting Started

Please watch test folder for examples 

-  Jetton example: The Test covers multi contract testing, all jetton's actions: mint, transfer, transfer notification 

`/test/jetton.spec.ts` Test Output:
```
-=== Print Chain ===- 
==[0....]==> 

         [0]  ⬅️  From: undefined EQDjhy....gv8iBr   🛄  Message: x{000000190000000000000001405F5E1006168322CDFD2E} ( 0.19💎 )    ➡️  To: OnChainContract EQBVyE....eO-VCE
         [1]  ⬅️  From: OnChainContract EQBVyE....eO-VCE   🛄  Message: Transfer ( 0.08💎 )    ➡️  To: OnChainContract EQAAH0....YqJ_Ql
         [2]  ⬅️  From: OnChainContract EQAAH0....YqJ_Ql   🛄  Message: Internal_transfer ( 0.08💎 )    ➡️  To: OnChainContract EQBYQb....ePp0n4
         [3]  ⬅️  From: OnChainContract EQBYQb....ePp0n4   🛄  Message: Excesses ( 0.07💎 )    ➡️  To: OnChainContract EQDjhy....gv8iBr

    ✔ Swap  (3417ms)
```
