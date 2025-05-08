process.removeAllListeners('warning');
process.on('warning', () => {});
// ========== APPEARANCE (Logo & Credit) ========== 
const ASCII_ART = `
  ___        _            _            
 / _ \      | |          | |           
/ /_\ \_   _| |_ ___   __| |_ __ ___  _ __ ____
|  _  | | | | __/ _ \ / _' | '__/ _ \| '_ \_  /
| | | | |_| | || (_) | (_| | | | (_) | |_) / / 
|_| |_|\__,_|\__\___/ \__,_|_|  \___/| .__/___|
                                     | |       
                                     |_|       
`;
const CREDIT = `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧑‍💻 Created by      : MrBip
🌐 GitHub            : https://github.com/NgChien
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

// ========== LOGGING ========== 
const chalk = require('chalk');
const logging = {
  log_info: (msg) => console.log(chalk.cyan('[INFO]'), msg),
  log_success: (msg) => console.log(chalk.green('[THÀNH CÔNG]'), msg),
  log_error: (msg) => console.log(chalk.red('[LỖI]'), msg),
  log_warning: (msg) => console.log(chalk.yellow('[CẢNH BÁO]'), msg),
  log_debug: (msg) => console.log(chalk.magenta('[DEBUG]'), msg),
  log_critical: (msg) => console.log(chalk.redBright('[CRITICAL]'), msg),
  log_fatal: (msg) => console.log(chalk.bgRed.white('[FATAL]'), msg),
  log_trace: (msg) => console.log(chalk.blue('[TRACE]'), msg),
};

// ========== CONFIG ========== 
const CONFIG = {
  RPC_URL: 'https://base-sepolia-rpc.publicnode.com',
  MINTING_CONTRACT: '0x9C868614ffca7da36B36330b1f317B117c7834dE',
  WRAP_CONTRACT: '0x50930beB58690a21c528dC351d6818F51CAfA480',
  USDC_ADDRESS: '0x9C868614ffca7da36B36330b1f317B117c7834dE',
  ERC20_ABI: [
    {"constant":true,"inputs":[{"name":"owner","type":"address"}],"name":"balanceOf","outputs":[{"name":"","type":"uint256"}],"type":"function"},
    {"constant":false,"inputs":[{"name":"spender","type":"address"},{"name":"amount","type":"uint256"}],"name":"approve","outputs":[{"name":"","type":"bool"}],"type":"function"}
  ],
  MINTING_CONTRACT_ABI: [
    {"constant":false,"inputs":[{"name":"to","type":"address"},{"name":"amount","type":"uint256"}],"name":"mint","outputs":[],"payable":false,"stateMutability":"nonpayable","type":"function"}
  ],
  WRAP_ABI: [
    {"type":"function","name":"wrap","inputs":[{"name":"amount","type":"uint256"}],"outputs":[],"stateMutability":"payable"}
  ],
  ACTION_CONFIG: {
    action: "auto",         // "mint", "shield", "auto", "check_balance"
    amount: 10000,            // Số lượng muốn mint/shield
    process_count: 1,      // Số tiến trình muốn chạy
    auto_mode: "auto",      // "auto" hoặc "once" (chỉ dùng khi action = "auto")
    WALLET_CONCURRENCY: 1   // Số luồng ví chạy song song
  }
};

// ========== UTILS ========== 
const fs = require('fs');
const { Web3 } = require('web3');
const pLimit = require('p-limit').default;

function readPrivateKeys(filename) {
    const lines = fs.readFileSync(filename, 'utf-8').split('\n');
    const keys = [];
    for (let line of lines) {
        let key = line.trim();
        if (!key) continue;
        if (key.startsWith('0x') || key.startsWith('0X')) key = key.slice(2);
        if (!/^([0-9a-fA-F]{64})$/.test(key)) {
            logging.log_error(`[LỖI] Private key không hợp lệ: ${key} (độ dài ${key.length})`);
            continue;
        }
        keys.push(key);
    }
    if (keys.length === 0) {
        logging.log_error('[LỖI] Không tìm thấy private key hợp lệ trong file key.txt!');
        process.exit(1);
    }
    return keys;
}

async function show_balance(address, web3) {
    try {
        const ethBalance = await web3.eth.getBalance(address);
        logging.log_info(`Số dư ETH: ${web3.utils.fromWei(ethBalance.toString(), 'ether')} ETH`);
        const usdc = new web3.eth.Contract(CONFIG.ERC20_ABI, CONFIG.USDC_ADDRESS);
        const usdcBalance = await usdc.methods.balanceOf(address).call();
        logging.log_info(`Số dư USDC: ${Number(usdcBalance) / 1e6} USDC`);
    } catch (e) {
        logging.log_error(`Không thể kiểm tra số dư: ${e.message}`);
    }
}

async function mint(privateKey, web3, amount) {
    try {
        const account = web3.eth.accounts.privateKeyToAccount('0x' + privateKey);
        const contract = new web3.eth.Contract(CONFIG.MINTING_CONTRACT_ABI, CONFIG.MINTING_CONTRACT);
        const wallet = account.address;
        const nonce = await web3.eth.getTransactionCount(wallet, 'pending');
        const gasPrice = await web3.eth.getGasPrice();
        const tx = contract.methods.mint(wallet, amount.toString());
        const gas = await tx.estimateGas({from: wallet});
        const data = tx.encodeABI();
        const txData = {
            from: wallet,
            to: CONFIG.MINTING_CONTRACT,
            data,
            gas: BigInt(Math.floor(Number(gas) * 1.2)),
            gasPrice: BigInt(Math.floor(Number(gasPrice) * 1.3))
        };
        const signed = await web3.eth.accounts.signTransaction(txData, '0x' + privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
        if (receipt.status) {
            logging.log_success(`Mint thành công! Tx Hash: ${receipt.transactionHash}`);
            return true;
        } else {
            logging.log_error(`Mint thất bại! Tx Hash: ${receipt.transactionHash}`);
            return false;
        }
    } catch (e) {
        logging.log_error(`Mint lỗi: ${e.message}`);
        return false;
    }
}

async function approve(privateKey, web3, spender, amount = 1000000) {
    try {
        const account = web3.eth.accounts.privateKeyToAccount('0x' + privateKey);
        const contract = new web3.eth.Contract(CONFIG.ERC20_ABI, CONFIG.USDC_ADDRESS);
        const wallet = account.address;
        const nonce = await web3.eth.getTransactionCount(wallet, 'pending');
        const gasPrice = await web3.eth.getGasPrice();
        const tx = contract.methods.approve(spender, amount.toString());
        const gas = await tx.estimateGas({from: wallet});
        const data = tx.encodeABI();
        const txData = {
            from: wallet,
            to: CONFIG.USDC_ADDRESS,
            data,
            gas: BigInt(Math.floor(Number(gas) * 1.2)),
            gasPrice: BigInt(Math.floor(Number(gasPrice) * 1.3))
        };
        const signed = await web3.eth.accounts.signTransaction(txData, '0x' + privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
        return receipt.status;
    } catch (e) {
        logging.log_error(`Approve lỗi: ${e.message}`);
        return false;
    }
}

async function wrap(privateKey, web3, amount) {
    try {
        const account = web3.eth.accounts.privateKeyToAccount('0x' + privateKey);
        const wallet = account.address;
        logging.log_info(`Đang approve USDC cho contract wrap...`);
        const approveSuccess = await approve(privateKey, web3, CONFIG.WRAP_CONTRACT, amount);
        if (!approveSuccess) {
            logging.log_error(`Approve thất bại!`);
            return false;
        }
        logging.log_success(`Approve thành công!`);
        const contract = new web3.eth.Contract(CONFIG.WRAP_ABI, CONFIG.WRAP_CONTRACT);
        const nonce = await web3.eth.getTransactionCount(wallet, 'pending');
        const gasPrice = await web3.eth.getGasPrice();
        const tx = contract.methods.wrap(amount.toString());
        const gas = await tx.estimateGas({from: wallet});
        const data = tx.encodeABI();
        const txData = {
            from: wallet,
            to: CONFIG.WRAP_CONTRACT,
            data,
            gas: BigInt(Math.floor(Number(gas) * 1.2)),
            gasPrice: BigInt(Math.floor(Number(gasPrice) * 1.3))
        };
        const signed = await web3.eth.accounts.signTransaction(txData, '0x' + privateKey);
        const receipt = await web3.eth.sendSignedTransaction(signed.rawTransaction);
        if (receipt.status) {
            logging.log_success(`Shield thành công! Tx Hash: ${receipt.transactionHash}`);
            return true;
        } else {
            logging.log_error(`Shield thất bại! Tx Hash: ${receipt.transactionHash}`);
            return false;
        }
    } catch (e) {
        logging.log_error(`Shield lỗi: ${e.message}`);
        return false;
    }
}

function waitUntilNextDay() {
    return new Promise(resolve => {
        logging.log_info('Đợi đến ngày tiếp theo (giả lập 5s)...');
        setTimeout(resolve, 5000);
    });
}

// ========== MAIN ========== 
async function runForWallet(privateKey, idx) {
    const web3 = new Web3(CONFIG.RPC_URL);
    const account = web3.eth.accounts.privateKeyToAccount('0x' + privateKey);
    const address = account.address;
    if (idx === 1) {
        console.log(ASCII_ART);
        console.log(CREDIT);
    }
    console.log(`\n=============================`);
    logging.log_info(`[TÀI KHOẢN ${idx}] Đang xử lý ví: ${address}`);
    console.log(`=============================`);
    logging.log_info('Đang kết nối tới node Sepolia...');
    try {
        const isListening = await web3.eth.net.isListening();
        if (isListening) {
            logging.log_success('Kết nối tới node Sepolia thành công!');
        } else {
            logging.log_error('Kết nối tới node Sepolia thất bại!');
            return;
        }
    } catch (e) {
        logging.log_error('Kết nối tới node Sepolia thất bại!');
        return;
    }
    console.log('-'.repeat(50));
    logging.log_info('Đang kiểm tra số dư...');
    console.log('-'.repeat(50));
    await show_balance(address, web3);
    const {action, amount, process_count, auto_mode} = CONFIG.ACTION_CONFIG;
    if (action === 'mint') {
        let success = 0;
        logging.log_info(`Đang mint ${amount} USDC với ${process_count} tiến trình...`);
        for (let i = 0; i < process_count; i++) {
            console.log('-'.repeat(50));
            if (await mint(privateKey, web3, amount)) success++;
        }
        logging.log_success(`Đã mint xong! ${success} giao dịch thành công.`);
    } else if (action === 'shield') {
        let success = 0;
        logging.log_info(`Đang shield ${amount} USDC với ${process_count} tiến trình...`);
        for (let i = 0; i < process_count; i++) {
            console.log('-'.repeat(50));
            if (await wrap(privateKey, web3, amount)) success++;
        }
        logging.log_success(`Đã shield xong! ${success} giao dịch thành công.`);
    } else if (action === 'auto') {
        while (true) {
            let success = 0;
            console.log('-'.repeat(50));
            logging.log_info(`Đang mint ${amount} USDC với ${process_count} tiến trình...`);
            for (let i = 0; i < process_count; i++) {
                console.log('-'.repeat(50));
                if (await mint(privateKey, web3, amount)) success++;
            }
            logging.log_success(`Đã mint xong! ${success} giao dịch thành công.`);
            success = 0;
            logging.log_info(`Đang shield ${amount} USDC với ${process_count} tiến trình...`);
            for (let i = 0; i < process_count; i++) {
                console.log('-'.repeat(50));
                if (await wrap(privateKey, web3, amount)) success++;
            }
            logging.log_success(`Đã shield xong! ${success} giao dịch thành công.`);
            if (auto_mode === 'once') break;
            await waitUntilNextDay();
        }
    } else if (action === 'check_balance') {
        console.log('-'.repeat(50));
        logging.log_info('Đang kiểm tra số dư...');
        await show_balance(address, web3);
        console.log('-'.repeat(50));
    } else {
        logging.log_error(`Hành động không hợp lệ: ${action}`);
    }
}

(async () => {
    const privateKeys = readPrivateKeys('./key.txt');
    const limit = pLimit(CONFIG.ACTION_CONFIG.WALLET_CONCURRENCY || 3);
    await Promise.all(privateKeys.map((key, i) => limit(() => runForWallet(key, i+1))));
    logging.log_info('Đã hoàn thành cho tất cả ví!');
})(); 