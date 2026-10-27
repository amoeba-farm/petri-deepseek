const args = process.argv.slice(2);
const command = args.find(arg => ['markets','long','status','--version'].includes(arg));
if (command === 'status') {
  setTimeout(()=>console.log(JSON.stringify({ok:true,data:{ready:true}})),30000);
} else if (command === 'long') {
  console.log(JSON.stringify({ok:false,error:{message:'fixture transaction refused'}}));
  process.exitCode=1;
} else if (command === '--version') {
  console.log('petri fixture');
} else {
  console.log(JSON.stringify({ok:true,data:{args,markets:[{market:'fixture-market',label:'RAMX',lastEntryValue:'101.25'}]}}));
}
