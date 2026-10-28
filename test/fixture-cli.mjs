const args = process.argv.slice(2);
const command = args.find(arg => ['markets','long','status','--version','commit'].includes(arg));
if (command === 'commit') {
  // A commit that landed and a reveal that failed: exit 0, ok false, what landed.
  console.log(JSON.stringify({ok:false,action:'oracle.updates.commit',revealed:false,transactions:[{signature:'5ig',slot:1,steps:['commitUpdate']}],
    error:{code:'ORACLE_REVEAL_FAILED',message:'the commit landed, but the reveal failed: fixture'},details:{revealCommand:'petri oracle updates reveal C1',revealByUtc:'2026-10-27T17:00:30.000Z'}}));
} else if (command === 'status') {
  setTimeout(()=>console.log(JSON.stringify({ok:true,data:{ready:true}})),30000);
} else if (command === 'long') {
  console.log(JSON.stringify({ok:false,error:{message:'fixture transaction refused'}}));
  process.exitCode=1;
} else if (command === '--version') {
  console.log('petri fixture');
} else {
  console.log(JSON.stringify({ok:true,data:{args,markets:[{market:'fixture-market',label:'RAMX',lastEntryValue:'101.25'}]}}));
}
