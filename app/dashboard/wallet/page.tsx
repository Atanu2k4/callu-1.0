"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Wallet, TrendingUp, TrendingDown, DollarSign, Clock, Plus, ArrowUpRight, ArrowDownLeft } from "lucide-react";

interface Transaction {
  _id: string;
  type: "credit" | "debit";
  amount: number;
  description: string;
  timestamp: string;
  status: "completed" | "pending" | "failed";
}

export default function WalletPage() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch wallet data from API
    const fetchWalletData = async () => {
      try {
        // TODO: Implement API endpoint for wallet
        // const res = await fetch(`/api/wallet`);
        // const data = await res.json();
        // setBalance(data.balance);
        // setTransactions(data.transactions);
        
        // Mock data for now
        setBalance(0);
        setTransactions([]);
      } catch (err) {
        console.error("Failed to fetch wallet data:", err);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchWalletData();
  }, [user]);

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 24) {
      return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-light tracking-tight text-white">Wallet</h2>
          <p className="text-zinc-500 mt-2">Manage your balance and transactions</p>
        </div>
        <button className="px-6 py-3 bg-white text-black font-medium rounded-xl hover:bg-zinc-200 transition-colors flex items-center gap-2">
          <Plus className="w-5 h-5" />
          Add Funds
        </button>
      </header>

      {/* Balance Card */}
      <div className="relative bg-gradient-to-br from-zinc-900 via-zinc-900 to-zinc-800 border border-zinc-800 rounded-3xl p-8 backdrop-blur-sm overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[100px]" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-3">
            <Wallet className="w-5 h-5 text-zinc-400" />
            <span className="text-sm text-zinc-400 uppercase tracking-wider font-medium">Available Balance</span>
          </div>
          <div className="flex items-baseline gap-2 mb-6">
            <span className="text-5xl font-light text-white tracking-tight">${balance.toFixed(2)}</span>
            <span className="text-zinc-500 text-lg">USD</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-emerald-500">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">+0.00%</span>
            </div>
            <span className="text-xs text-zinc-500">Last 30 days</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button className="group bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm hover:border-zinc-700 hover:bg-zinc-800/60 transition-all text-left">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-xl flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
              <ArrowUpRight className="w-6 h-6 text-emerald-500" />
            </div>
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Top Up</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-1">Add Funds</h3>
          <p className="text-sm text-zinc-500">Deposit money to your wallet</p>
        </button>

        <button className="group bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 backdrop-blur-sm hover:border-zinc-700 hover:bg-zinc-800/60 transition-all text-left">
          <div className="flex items-center justify-between mb-3">
            <div className="w-12 h-12 bg-blue-500/10 rounded-xl flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
              <ArrowDownLeft className="w-6 h-6 text-blue-500" />
            </div>
            <span className="text-xs text-zinc-500 uppercase tracking-wider">Withdraw</span>
          </div>
          <h3 className="text-lg font-medium text-white mb-1">Cash Out</h3>
          <p className="text-sm text-zinc-500">Transfer to your bank account</p>
        </button>
      </div>

      {/* Transaction History */}
      <div>
        <h3 className="text-xl font-light text-white mb-4">Recent Transactions</h3>
        
        {!loading && transactions.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] w-full bg-zinc-900/40 border border-zinc-800 rounded-2xl backdrop-blur-sm p-12">
            <div className="w-20 h-20 mb-4 bg-zinc-900/50 rounded-full flex items-center justify-center border border-zinc-800">
              <DollarSign className="w-10 h-10 text-zinc-600" />
            </div>
            <div className="text-center space-y-2 max-w-sm">
              <h4 className="text-xl font-light text-white">No Transactions Yet</h4>
              <p className="text-zinc-500 text-sm leading-relaxed">
                Your transaction history will appear here once you start using your wallet.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((transaction) => (
              <div
                key={transaction._id}
                className="group bg-zinc-900/40 border border-zinc-800/50 rounded-xl p-4 backdrop-blur-sm hover:border-zinc-700/80 hover:bg-zinc-800/60 transition-all duration-300"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      transaction.type === "credit" 
                        ? "bg-emerald-500/10 text-emerald-500" 
                        : "bg-red-500/10 text-red-500"
                    }`}>
                      {transaction.type === "credit" ? (
                        <TrendingUp className="w-5 h-5" />
                      ) : (
                        <TrendingDown className="w-5 h-5" />
                      )}
                    </div>

                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">
                        {transaction.description}
                      </span>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <Clock className="w-3 h-3" />
                        {formatTimestamp(transaction.timestamp)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className={`text-base font-medium ${
                      transaction.type === "credit" ? "text-emerald-500" : "text-red-500"
                    }`}>
                      {transaction.type === "credit" ? "+" : "-"}${transaction.amount.toFixed(2)}
                    </span>
                    <span className={`text-xs ${
                      transaction.status === "completed" 
                        ? "text-zinc-500" 
                        : transaction.status === "pending"
                        ? "text-yellow-500"
                        : "text-red-500"
                    }`}>
                      {transaction.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
