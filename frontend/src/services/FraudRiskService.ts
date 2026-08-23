import {
    FraudAlert,
    BlocklistEntry,
    RiskMatrixCell,
    ComprehensiveFraudPayload,
    RiskSeverity,
    AlertCategory,
    ActionStatus,
    BlocklistSubmitForm
} from '../types/fraudRisk';

class FraudRiskServiceAPI {
    private alertsDataset: FraudAlert[] = [];
    private blocklistDataset: BlocklistEntry[] = [];

    constructor() {
        this.hydrateMockData();
    }

    private hydrateMockData() {
        const severities: RiskSeverity[] = ['SAFE', 'LOW', 'MEDIUM', 'MEDIUM', 'HIGH', 'HIGH', 'CRITICAL'];
        const categories: AlertCategory[] = ['VELOCITY', 'LOCATION_ANOMALY', 'DEVICE_SPOOFING', 'IP_MISMATCH', 'HIGH_VALUE_TXN', 'BLACKLISTED_BIN', 'MULTIPLE_FAILURES'];
        const statuses: ActionStatus[] = ['OPEN', 'OPEN', 'INVESTIGATING', 'ESCALATED', 'RESOLVED', 'FALSE_POSITIVE'];

        // Generate 500 alerts for realism
        for (let i = 0; i < 500; i++) {
            const sev = severities[Math.floor(Math.random() * severities.length)];
            const riskScore = sev === 'CRITICAL' ? 90 + Math.random() * 10 : sev === 'HIGH' ? 70 + Math.random() * 20 : sev === 'MEDIUM' ? 40 + Math.random() * 30 : Math.random() * 40;

            this.alertsDataset.push({
                id: `f_alert_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`,
                timestamp: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
                customerId: `cus_${Math.floor(Math.random() * 99999)}`,
                customerEmail: `user_${Math.floor(Math.random() * 9999)}@example.com`,
                transactionId: Math.random() > 0.3 ? `txn_${Math.random().toString(36).substr(2, 9)}` : undefined,
                category: categories[Math.floor(Math.random() * categories.length)],
                severity: sev,
                status: statuses[Math.floor(Math.random() * statuses.length)],
                riskScore,
                location: {
                    ipAddress: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.0`,
                    country: Math.random() > 0.7 ? 'RU' : Math.random() > 0.4 ? 'NG' : 'US',
                    city: 'Unknown Routing',
                    asn: `AS${Math.floor(Math.random() * 9999)}`,
                    isVpnOrProxy: Math.random() > 0.6,
                    distanceFromBillingMiles: Math.floor(Math.random() * 5000)
                },
                device: {
                    deviceId: `dev_${Math.random().toString(36).substr(2, 8)}`,
                    deviceType: Math.random() > 0.5 ? 'MOBILE' : 'DESKTOP',
                    os: 'Windows 10',
                    browser: 'Chrome 110',
                    isEmulator: Math.random() > 0.9,
                    screenResolution: '1920x1080'
                },
                description: `Suspicious activity detected triggering automated risk vectors.`,
                automatedActionTaken: sev === 'CRITICAL' ? 'TXN_BLOCKED' : sev === 'HIGH' ? 'CHALLENGE_ISSUED' : 'NONE'
            });
        }

        this.alertsDataset.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        // Blocklist Data
        const types: ('IP' | 'EMAIL' | 'CARD_BIN' | 'DEVICE_ID')[] = ['IP', 'EMAIL', 'CARD_BIN', 'DEVICE_ID'];
        for (let i = 0; i < 30; i++) {
            const bType = types[Math.floor(Math.random() * 4)];
            this.blocklistDataset.push({
                id: `blk_${Math.random().toString(36).substr(2, 9)}`,
                type: bType,
                value: bType === 'IP' ? '185.192.x.x' : bType === 'EMAIL' ? '*@suspicious.biz' : bType === 'CARD_BIN' ? '411111' : 'dev_xyz123',
                addedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
                addedBy: 'admin_sys',
                reason: 'Repeated authorization failures and card testing.',
                expiresAt: Math.random() > 0.5 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : undefined
            });
        }
    }

    public async getDashboardData(): Promise<ComprehensiveFraudPayload> {
        await new Promise(r => setTimeout(r, 600));

        const now = Date.now();
        const alerts24h = this.alertsDataset.filter(a => now - new Date(a.timestamp).getTime() < 24 * 60 * 60 * 1000);

        // Matrix generation (simulating 5x5 heatmap grid for UI rendering)
        const matrix: RiskMatrixCell[] = [];
        for (let x = 0; x < 5; x++) {
            for (let y = 0; y < 5; y++) {
                matrix.push({
                    xRange: [x * 20, (x + 1) * 20],
                    yRange: [y * 20, (y + 1) * 20],
                    density: Math.floor(Math.random() * 50),
                    averageRiskScore: (x + y) * 10 + Math.random() * 20,
                    alertIds: []
                });
            }
        }

        return {
            alerts: this.alertsDataset.slice(0, 50), // Send latest 50
            metrics: {
                totalAlerts24h: alerts24h.length,
                criticalAlerts24h: alerts24h.filter(a => a.severity === 'CRITICAL').length,
                activeInvestigations: this.alertsDataset.filter(a => a.status === 'INVESTIGATING' || a.status === 'ESCALATED').length,
                blockedTxnVolume: 125430.50, // mock dollar val
                falsePositiveRate: 12.4, // %
                avgResolutionMinutes: 45.2,
                topRiskVector: 'LOCATION_ANOMALY'
            },
            blocklist: this.blocklistDataset.slice(0, 15),
            matrix
        };
    }

    public async addToBlocklist(form: BlocklistSubmitForm): Promise<BlocklistEntry> {
        await new Promise(r => setTimeout(r, 800));
        const entry: BlocklistEntry = {
            id: `blk_${Math.random().toString(36).substr(2, 9)}`,
            type: form.type,
            value: form.value,
            addedAt: new Date().toISOString(),
            addedBy: 'current_user',
            reason: form.reason,
            expiresAt: form.durationDays ? new Date(Date.now() + form.durationDays * 24 * 60 * 60 * 1000).toISOString() : undefined
        };
        this.blocklistDataset.unshift(entry);
        return entry;
    }
}

export const FraudRiskService = new FraudRiskServiceAPI();
