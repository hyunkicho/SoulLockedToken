import React, { useState } from 'react';
import { BrowserProvider, Contract } from 'ethers';
import SoulLockedTokenABI from './SoulLockedTokenNew.json';

function AdminMinter() {
    const [formInput, setFormInput] = useState({
        to: '',
        tokenId: '',
        credId: '',
        pubKeyX: '',
        pubKeyY: '',
    });
    const [status, setStatus] = useState('');

    // ✅ UPDATED HELPER FUNCTION
    const base64UrlToHex = (str) => {
        const base64 = str.replace(/-/g, '+').replace(/_/g, '/');
        let padded = base64;
        while (padded.length % 4 !== 0) {
            padded += '=';
        }
        const raw = atob(padded);
        let hex = '0x';
        for (let i = 0; i < raw.length; i++) {
            const byte = raw.charCodeAt(i).toString(16);
            hex += byte.length === 2 ? byte : '0' + byte;
        }
        return hex;
    };

    const handleMint = async () => {
        if (!window.ethereum) {
            alert("Please install MetaMask.");
            return;
        }

        if (!formInput.to || !formInput.tokenId || !formInput.credId || !formInput.pubKeyX || !formInput.pubKeyY) {
            setStatus('All fields are required.');
            return;
        }

        try {
            setStatus('Preparing to mint...');
            const provider = new BrowserProvider(window.ethereum);
            await provider.send("eth_requestAccounts", []);
            const signer = await provider.getSigner();

            const contractAddress = "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9"; // Remember to put your contract address here
            const contract = new Contract(contractAddress, SoulLockedTokenABI.abi, signer);

            const credIdBytes = base64UrlToHex(formInput.credId);
            const pubKeyCoordinates = [formInput.pubKeyX, formInput.pubKeyY];

            setStatus('Sending transaction...');
            const transaction = await contract.safeMint(
                formInput.to,
                formInput.tokenId,
                credIdBytes,
                pubKeyCoordinates
            );

            await transaction.wait();
            setStatus(`Minting successful! Tx hash: ${transaction.hash}`);
        } catch (err) {
            console.error(err);
            setStatus('Minting failed: ' + (err.reason || err.message));
        }
    };

    const handleChange = (e) => {
        setFormInput({ ...formInput, [e.target.name]: e.target.value });
    };

    return (
        <div>
            <h2>2. NFT Minting (Admin Only)</h2>
            <input name="to" placeholder="Receiver's address (to)" onChange={handleChange} />
            <input name="tokenId" placeholder="Token ID" onChange={handleChange} />
            <input name="credId" placeholder="Credential ID (Base64URL)" onChange={handleChange} style={{width: '300px'}}/>
            <input name="pubKeyX" placeholder="Public Key X" onChange={handleChange} style={{width: '400px'}}/>
            <input name="pubKeyY" placeholder="Public Key Y" onChange={handleChange} style={{width: '400px'}}/>
            <button onClick={handleMint}>safeMint</button>
            {status && <p>{status}</p>}
        </div>
    );
}

export default AdminMinter;