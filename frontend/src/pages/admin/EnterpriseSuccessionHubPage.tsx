import { useState, useEffect } from 'react';
import axios from 'axios';
import SuccessionTalentMatrix from '../../components/admin/SuccessionTalentMatrix';
import FlightRiskTopology from '../../components/admin/FlightRiskTopology';
import { Target, Users, Zap, LayoutDashboard, BrainCircuit, Activity, ChevronRight } from 'lucide-react';
import { successionAPI } from '../../services/admin/successionService'; // Assume this will be created

export default function EnterpriseSuccessionHubPage() {
    const [loading, setLoading] = useState(true);
    const [matrixData, setMatrixData] = useState<any>({});
    const [topologyData, setTopologyData] = useState<any[]>([]);
    const [summaryData, setSummaryData] = useState<any>({
        talentPoolSize: 0,
        highFlightRiskEmployees: 0,
        successionCoverage: { active: 0, totalRequired: 0 }
    });

    const [departmentFilter, setDepartmentFilter] = useState('');
    const [activeTab, setActiveTab] = useState<'MATRIX' | 'TOPOLOGY'>('MATRIX');

    useEffect(() => {
        fetchDashboardData();
    }, [departmentFilter]);

    const fetchDashboardData = async () => {
        setLoading(true);
        try {
            const [matrixRes, topologyRes, summaryRes] = await Promise.all([
                successionAPI.getTalentMatrix(departmentFilter),
                successionAPI.getFlightRiskTopology(),
                successionAPI.getDashboardSummary()
            ]);

            setMatrixData(matrixRes.data?.data?.matrix || {});
            setTopologyData(topologyRes.data?.data || []);
            setSummaryData(summaryRes.data?.data || summaryData);
        } catch (error) {
            console.error("Failed to load succession data:", error);
        } finally {
            setLoading(false);
        }
    };

    const seedMockData = async () => {
        try {
            await successionAPI.seedDemoData();
            fetchDashboardData();
        } catch (e) {
            alert("Error seeding data");
        }
    };

    return (
        <div className="min-h-screen bg-black/95 text-gray-200">

            {/* Top Navigation / Header */}
            <div className="sticky top-0 z-50 bg-black/80 backdrop-blur-xl border-b border-gray-800 px-6 py-4 flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-3">
                    <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 rounded-xl flex items-center justify-center p-0.5 shadow-lg shadow-indigo-500/20">
                        <div className="h-full w-full bg-gray-950 rounded-[10px] flex items-center justify-center">
                            <BrainCircuit className="h-5 w-5 text-indigo-400" />
                        </div>
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-white tracking-tight">Enterprise Succession Hub</h1>
                        <p className="text-xs text-gray-400 flex items-center gap-1 font-medium tracking-wide">
                            AI-Powered Talent Architecture <ChevronRight className="h-3 w-3" /> Dashboard
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <select
                        value={departmentFilter}
                        onChange={(e) => setDepartmentFilter(e.target.value)}
                        className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-gray-300 focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                        <option value="">Global Organization</option>
                        <option value="Engineering">Engineering</option>
                        <option value="Sales">Sales</option>
                        <option value="Product">Product</option>
                        <option value="Finance">Finance</option>
                    </select>

                    <button
                        onClick={seedMockData}
                        className="bg-gray-800 hover:bg-gray-700 border border-gray-600 text-gray-200 px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 shadow-sm"
                    >
                        <Zap className="h-4 w-4 text-emerald-400" /> Seed Data
                    </button>
                </div>
            </div>

            <div className="max-w-[1400px] mx-auto p-6 space-y-6">

                {/* KPI Stat Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Card 1 */}
                    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Monitored Talent</p>
                                <h3 className="text-3xl font-black text-white mt-1">{summaryData.talentPoolSize}</h3>
                            </div>
                            <div className="h-8 w-8 bg-indigo-500/20 rounded-lg flex items-center justify-center border border-indigo-500/30">
                                <Users className="h-4 w-4 text-indigo-400" />
                            </div>
                        </div>
                        <div className="text-xs text-emerald-400 font-medium bg-emerald-500/10 inline-block px-2 py-1 rounded">
                            +12% vs last quarter
                        </div>
                    </div>

                    {/* Card 2 */}
                    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/10 blur-3xl rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Critical Flight Risks</p>
                                <h3 className="text-3xl font-black text-white mt-1">{summaryData.highFlightRiskEmployees}</h3>
                            </div>
                            <div className="h-8 w-8 bg-red-500/20 rounded-lg flex items-center justify-center border border-red-500/30">
                                <Activity className="h-4 w-4 text-red-400" />
                            </div>
                        </div>
                        <div className="text-xs text-red-400 font-medium bg-red-500/10 inline-block px-2 py-1 rounded truncate w-full">
                            Immediate intervention required
                        </div>
                    </div>

                    {/* Card 3 */}
                    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-5 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 blur-3xl rounded-full -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Succession Coverage</p>
                                <h3 className="text-3xl font-black text-white mt-1">
                                    {summaryData.successionCoverage.active}/{summaryData.successionCoverage.totalRequired}
                                </h3>
                            </div>
                            <div className="h-8 w-8 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
                                <Target className="h-4 w-4 text-emerald-400" />
                            </div>
                        </div>
                        <div className="w-full bg-gray-800 h-1.5 rounded-full mt-3 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full"
                                style={{ width: `${(summaryData.successionCoverage.active / (summaryData.successionCoverage.totalRequired || 1)) * 100}%` }}
                            ></div>
                        </div>
                    </div>

                    {/* Card 4 */}
                    <div className="bg-gray-900/50 backdrop-blur-sm border border-gray-800 rounded-xl p-5 flex flex-col items-center justify-center text-center cursor-pointer hover:bg-gray-800/80 transition shadow-inner">
                        <div className="h-12 w-12 bg-gray-800 rounded-full flex items-center justify-center border border-gray-700 mb-3 group-hover:border-indigo-500/50 group-hover:scale-110 transition-all">
                            <LayoutDashboard className="h-5 w-5 text-indigo-400" />
                        </div>
                        <h4 className="font-bold text-white">Generate Reports</h4>
                        <p className="text-xs text-gray-500 mt-1">Export SEC compliant talent data</p>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex bg-gray-900/50 border border-gray-800 rounded-lg p-1 w-max">
                    <button
                        onClick={() => setActiveTab('MATRIX')}
                        className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'MATRIX' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
                    >
                        9-Box Talent Matrix
                    </button>
                    <button
                        onClick={() => setActiveTab('TOPOLOGY')}
                        className={`px-6 py-2 text-sm font-medium rounded-md transition-all ${activeTab === 'TOPOLOGY' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800'}`}
                    >
                        Flight Risk Topology
                    </button>
                </div>

                {/* Main View Area */}
                <div className="min-h-[500px]">
                    {activeTab === 'MATRIX' ? (
                        <SuccessionTalentMatrix matrix={matrixData} loading={loading} />
                    ) : (
                        <FlightRiskTopology data={topologyData} loading={loading} />
                    )}
                </div>

            </div>
        </div>
    );
}
