import { ethers } from "https://esm.sh/ethers@6.13.4";
import EthereumProvider from "https://esm.sh/@walletconnect/ethereum-provider@2.17.2";

const CONTRACT_ADDRESS="PASTE_CONTRACT_ADDRESS_HERE";
const PROJECT_ID="fe55ea601c3e7e0925c0b33723d6b158";
const READ_RPC="https://ethereum.publicnode.com";
const PRICE_ETH="0.0001";
const MAX_SUPPLY=10000;

const ABI=[
  "function mint(uint256 amount) external payable",
  "function PRICE() view returns (uint256)",
  "function totalSupply() view returns (uint256)",
  "function freeMintUsed(address user) view returns (bool)"
];

let provider, signer, contract, readProvider, readContract, account, wcProvider;
const $=id=>document.getElementById(id);
const modal=$("walletModal");

function text(id,v){const e=$(id);if(e)e.textContent=v}
function status(v){text("status",v)}
function openModal(){modal.classList.remove("hidden")}
function closeModal(){modal.classList.add("hidden")}
function amount(){let v=Number($("amount").value);if(!v||v<1)v=1;if(v>100)v=100;$("amount").value=v;return v}

function initRead(){
  if(CONTRACT_ADDRESS==="PASTE_CONTRACT_ADDRESS_HERE"){status("Insert contract address in app.js");return false}
  readProvider=new ethers.JsonRpcProvider(READ_RPC);
  readContract=new ethers.Contract(CONTRACT_ADDRESS,ABI,readProvider);
  const link=$("etherscanLink"); if(link) link.href="https://etherscan.io/address/"+CONTRACT_ADDRESS;
  return true;
}

async function loadSupply(){
  try{
    if(!readContract&&!initRead())return;
    const supply=Number(await readContract.totalSupply());
    const remaining=Math.max(0,MAX_SUPPLY-supply);
    const percent=Math.min(100,supply/MAX_SUPPLY*100);
    text("mintedText",supply.toLocaleString("en-US").replaceAll(","," "));
    text("remainingText",remaining.toLocaleString("en-US").replaceAll(","," "));
    text("mintedBottom",supply.toLocaleString("en-US").replaceAll(","," "));
    text("progressText",percent.toFixed(0)+"% minted");
    $("progressBar").style.width=percent+"%";
    await updatePrice();
  }catch(e){status("Read error: "+(e.shortMessage||e.message))}
}

async function setup(wp,acc){
  if(CONTRACT_ADDRESS==="PASTE_CONTRACT_ADDRESS_HERE")throw new Error("Insert contract address in app.js");
  provider=new ethers.BrowserProvider(wp);
  signer=await provider.getSigner();
  account=acc||await signer.getAddress();
  contract=new ethers.Contract(CONTRACT_ADDRESS,ABI,signer);
  readContract=contract;
  const short=account.slice(0,6)+"..."+account.slice(-4);
  text("wallet",short);
  text("topConnect",short);
  $("connectBtn").style.display="none";
  $("mintBtn").style.display="block";
  closeModal();
  await loadSupply();
}

async function connectBrowser(){
  try{
    if(!window.ethereum)throw new Error("Wallet not found");
    if(await window.ethereum.request({method:"eth_chainId"})!=="0x1"){
      await window.ethereum.request({method:"wallet_switchEthereumChain",params:[{chainId:"0x1"}]});
    }
    const acc=await window.ethereum.request({method:"eth_requestAccounts"});
    await setup(window.ethereum,acc[0]);
  }catch(e){status("Error: "+(e.shortMessage||e.message))}
}

async function connectWC(){
  try{
    wcProvider=await EthereumProvider.init({projectId:PROJECT_ID,chains:[1],optionalChains:[1],showQrModal:true});
    await wcProvider.connect();
    await setup(wcProvider,(wcProvider.accounts||[])[0]);
  }catch(e){status("Error: "+(e.shortMessage||e.message))}
}

async function getPrice(){
  if(contract){try{return await contract.PRICE()}catch(e){}}
  return ethers.parseEther(PRICE_ETH);
}

async function getPaidAmount(){
  const q=BigInt(amount());
  if(!contract||!account)return q>0n?q-1n:0n;
  const used=await contract.freeMintUsed(account);
  return used?q:(q>0n?q-1n:0n);
}

async function updatePrice(){
  try{
    const price=await getPrice();
    const paid=await getPaidAmount();
    const total=price*paid;
    text("totalPrice",total===0n?"FREE":ethers.formatEther(total)+" ETH");
    text("priceText",total===0n?"FREE":ethers.formatEther(total)+" ETH");
  }catch(e){status("Price error: "+(e.shortMessage||e.message))}
}

async function mint(){
  try{
    if(!contract){openModal();return}
    const q=BigInt(amount());
    const price=await getPrice();
    const paid=await getPaidAmount();
    status("Confirm mint...");
    const tx=await contract.mint(Number(q),{value:price*paid});
    status("Tx: "+tx.hash);
    await tx.wait();
    status("Mint success");
    await loadSupply();
  }catch(e){status("Error: "+(e.shortMessage||e.message))}
}

$("topConnect").onclick=openModal;
$("openMintBtn").onclick=openModal;
$("connectBtn").onclick=openModal;
$("closeModalBtn").onclick=closeModal;
$("browserWalletBtn").onclick=connectBrowser;
$("walletConnectBtn").onclick=connectWC;
$("mintBtn").onclick=mint;
$("minus").onclick=async()=>{$("amount").value=Math.max(1,amount()-1);await updatePrice()};
$("plus").onclick=async()=>{$("amount").value=Math.min(100,amount()+1);await updatePrice()};
$("amount").oninput=updatePrice;

initRead();
loadSupply();
updatePrice();
