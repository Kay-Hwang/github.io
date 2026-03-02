import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, exportDatabase, importDatabase } from '@/services/db';
import { PortfolioService } from '@/services/finance';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Settings, Download, Upload, Trash2, CheckCircle2, AlertCircle, Plus, Wallet } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

export function SettingsDialog() {
    const [open, setOpen] = useState(false);
    const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

    // Account Form State
    const [newAccountName, setNewAccountName] = useState('');
    const [newAccountType, setNewAccountType] = useState<'ISA' | 'Normal' | 'Pension'>('Normal');
    const [newAccountCurrency, setNewAccountCurrency] = useState<'KRW' | 'USD'>('KRW');

    const accounts = useLiveQuery(() => db.accounts.toArray());

    const handleAddAccount = async () => {
        if (!newAccountName.trim()) return;
        try {
            await PortfolioService.addAccount({
                name: newAccountName,
                type: newAccountType,
                currency: newAccountCurrency
            });
            setNewAccountName('');
            setNewAccountType('Normal');
            setNewAccountCurrency('KRW');
        } catch (error) {
            console.error('Failed to add account:', error);
        }
    };

    const handleDeleteAccount = async (id: number) => {
        if (confirm('Are you sure you want to delete this account? WARNING: All associated transactions will also be permanently deleted.')) {
            try {
                await PortfolioService.deleteAccount(id);
            } catch (error) {
                console.error('Failed to delete account:', error);
            }
        }
    };

    const handleExport = async () => {
        try {
            const jsonString = await exportDatabase();
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `asset-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            setImportStatus({ type: 'success', message: 'Backup successfully downloaded!' });
        } catch (error) {
            console.error('Export failed:', error);
            setImportStatus({ type: 'error', message: 'Export failed. Check console for details.' });
        }
    };

    const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!confirm('경고: 현재 기기에 저장된 모든 자산 및 거래 내역 데이터가 백업 파일 내용으로 덮어쓰기 됩니다. 계속하시겠습니까?')) {
            // Reset input so the user can select the same file again if they cancel
            event.target.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const text = e.target?.result as string;
                await importDatabase(text);
                setImportStatus({ type: 'success', message: 'Data restored successfully! Reloading...' });
                setTimeout(() => window.location.reload(), 1500);
            } catch (error) {
                console.error('Import failed:', error);
                setImportStatus({ type: 'error', message: 'Import failed. Invalid file or data error.' });
            }
        };
        reader.readAsText(file);
    };

    const handleReset = async () => {
        if (confirm('Are you sure you want to delete all data? This cannot be undone.')) {
            try {
                await db.transaction('rw', db.accounts, db.assets, db.transactions, async () => {
                    await db.accounts.clear();
                    await db.assets.clear();
                    await db.transactions.clear();
                });
                localStorage.setItem('hasSeeded', 'true');
                window.location.reload();
            } catch (e) {
                console.error(e);
            }
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="text-zinc-400 hover:text-white hover:bg-zinc-800">
                    <Settings className="h-5 w-5" />
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-100">
                <DialogHeader>
                    <DialogTitle>Settings</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Manage your accounts and data.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="accounts" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 bg-zinc-900">
                        <TabsTrigger value="accounts">Accounts</TabsTrigger>
                        <TabsTrigger value="data">Data Management</TabsTrigger>
                    </TabsList>

                    <TabsContent value="accounts" className="space-y-4 pt-4">
                        <div className="space-y-4">
                            {/* Add Account Form */}
                            <div className="bg-zinc-900/50 p-4 rounded-lg border border-zinc-800 space-y-3">
                                <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                                    <Plus className="w-4 h-4" /> Add New Account
                                </h4>
                                <div className="grid gap-2">
                                    <Label htmlFor="name" className="sr-only">Name</Label>
                                    <Input
                                        id="name"
                                        placeholder="Account Name (e.g. Kiwoom ISA)"
                                        value={newAccountName}
                                        onChange={(e) => setNewAccountName(e.target.value)}
                                        className="bg-zinc-950 border-zinc-800"
                                    />
                                    <div className="flex gap-2">
                                        <Select value={newAccountType} onValueChange={(val: any) => setNewAccountType(val)}>
                                            <SelectTrigger className="bg-zinc-950 border-zinc-800">
                                                <SelectValue placeholder="Type" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                                <SelectItem value="Normal">Normal</SelectItem>
                                                <SelectItem value="ISA">ISA</SelectItem>
                                                <SelectItem value="Pension">Pension</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <Select value={newAccountCurrency} onValueChange={(val: any) => setNewAccountCurrency(val)}>
                                            <SelectTrigger className="bg-zinc-950 border-zinc-800 w-[100px]">
                                                <SelectValue placeholder="Currency" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                                <SelectItem value="KRW">KRW</SelectItem>
                                                <SelectItem value="USD">USD</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button onClick={handleAddAccount} disabled={!newAccountName.trim()} className="w-full bg-blue-600 hover:bg-blue-700 text-white">
                                        Create Account
                                    </Button>
                                </div>
                            </div>

                            {/* Accounts List */}
                            <div className="space-y-2">
                                <h4 className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                                    <Wallet className="w-4 h-4" /> Your Accounts
                                </h4>
                                <div className="space-y-2 max-h-[200px] overflow-auto pr-1">
                                    {accounts?.map(account => (
                                        <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-zinc-900 border border-zinc-800">
                                            <div>
                                                <div className="font-medium text-sm text-zinc-200">{account.name}</div>
                                                <div className="text-xs text-zinc-500">{account.type} • {account.currency}</div>
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-8 w-8 text-zinc-400 hover:text-red-400 hover:bg-red-900/20"
                                                onClick={() => handleDeleteAccount(account.id!)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    {accounts?.length === 0 && (
                                        <div className="text-center text-sm text-zinc-500 py-4">
                                            No accounts found.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </TabsContent>

                    <TabsContent value="data" className="space-y-6 pt-4">
                        {/* Refresh Names */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-zinc-300">Data Synchronization</h4>
                            <Button
                                onClick={async () => {
                                    try {
                                        await PortfolioService.refreshAllAssetNames();
                                        setImportStatus({ type: 'success', message: 'Asset names refreshed successfully!' });
                                        setTimeout(() => window.location.reload(), 1500);
                                    } catch (e) {
                                        setImportStatus({ type: 'error', message: 'Failed to refresh asset names.' });
                                    }
                                }}
                                variant="outline"
                                className="w-full justify-start gap-2 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-100"
                            >
                                <CheckCircle2 className="h-4 w-4" /> Refresh All Stock Names
                            </Button>
                        </div>

                        {/* Export */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-zinc-300">Backup (데이터 내보내기)</h4>
                            <Button onClick={handleExport} variant="outline" className="w-full justify-start gap-2 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-100">
                                <Download className="h-4 w-4" /> 다운로드 (.json)
                            </Button>
                        </div>

                        {/* Import */}
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-zinc-300">Restore (데이터 불러오기)</h4>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept=".json"
                                    onChange={handleImport}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                />
                                <Button variant="outline" className="w-full justify-start gap-2 bg-zinc-800 border-zinc-700 hover:bg-zinc-700 text-zinc-100">
                                    <Upload className="h-4 w-4" /> 백업 파일 업로드 (.json)
                                </Button>
                            </div>
                            <p className="text-xs text-zinc-500">주의: 현재 저장된 모든 데이터가 삭제되고 덮어쓰기 됩니다.</p>
                        </div>

                        {/* Reset */}
                        <div className="space-y-2 pt-4 border-t border-zinc-800">
                            <h4 className="text-sm font-medium text-red-400">Danger Zone</h4>
                            <Button onClick={handleReset} variant="destructive" className="w-full justify-start gap-2 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50">
                                <Trash2 className="h-4 w-4" /> Reset All Data
                            </Button>
                        </div>

                        {importStatus.type && (
                            <Alert className={`${importStatus.type === 'success' ? 'border-emerald-500/50 text-emerald-500' : 'border-red-500/50 text-red-500'} bg-transparent`}>
                                {importStatus.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                <AlertTitle>{importStatus.type === 'success' ? 'Success' : 'Error'}</AlertTitle>
                                <AlertDescription>
                                    {importStatus.message}
                                </AlertDescription>
                            </Alert>
                        )}
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}
