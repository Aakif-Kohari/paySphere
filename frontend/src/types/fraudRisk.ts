export type RiskSeverity = 'SAFE' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AlertCategory = 'VELOCITY' | 'LOCATION_ANOMALY' | 'DEVICE_SPOOFING' | 'IP_MISMATCH' | 'HIGH_VALUE_TXN' | 'BLACKLISTED_BIN' | 'MULTIPLE_FAILURES';
export type ActionStatus = 'OPEN' | 'INVESTIGATING' | 'ESCALATED' | 'RESOLVED' | 'FALSE_POSITIVE';

export interface LocationData {
    ipAddress: string;
    country: string;
    city: string;
    asn: string;
    isVpnOrProxy: boolean;
    distanceFromBillingMiles?: number;
}

export interface DeviceData {
    deviceId: string;
    deviceType: 'MOBILE' | 'DESKTOP' | 'TABLET' | 'UNKNOWN';
    os: string;
    browser: string;
    isEmulator: boolean;
    screenResolution: string;
}

export interface FraudAlert {
    id: string;
    timestamp: string;
    customerId: string;
    customerEmail: string;
    transactionId?: string;
    category: AlertCategory;
    severity: RiskSeverity;
    status: ActionStatus;
    riskScore: number; // 0 to 100
    location: LocationData;
    device: DeviceData;
    description: string;
    automatedActionTaken?: 'NONE' | 'TXN_BLOCKED' | 'ACCOUNT_FROZEN' | 'CHALLENGE_ISSUED';
}

export interface BlocklistEntry {
    id: string;
    type: 'IP' | 'EMAIL' | 'CARD_BIN' | 'DEVICE_ID';
    value: string;
    addedAt: string;
    addedBy: string;
    reason: string;
    expiresAt?: string;
}

export interface RiskMatrixCell {
    xRange: [number, number]; // e.g., txn velocity
    yRange: [number, number]; // e.g., transaction amount
    density: number;
    averageRiskScore: number;
    alertIds: string[];
}

export interface FraudMetrics {
    totalAlerts24h: number;
    criticalAlerts24h: number;
    activeInvestigations: number;
    blockedTxnVolume: number; // Dollar amount blocked
    falsePositiveRate: number; // Percentage
    avgResolutionMinutes: number;
    topRiskVector: AlertCategory;
}

export interface ComprehensiveFraudPayload {
    alerts: FraudAlert[];
    metrics: FraudMetrics;
    blocklist: BlocklistEntry[];
    matrix: RiskMatrixCell[];
}

export interface BlocklistSubmitForm {
    type: 'IP' | 'EMAIL' | 'CARD_BIN' | 'DEVICE_ID';
    value: string;
    reason: string;
    durationDays?: number;
}
