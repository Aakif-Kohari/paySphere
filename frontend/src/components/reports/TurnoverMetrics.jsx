import React, { useEffect, useState } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line
} from 'recharts';
import api from '../../services/api';

const TurnoverMetrics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/api/reports/turnover');
        setData(res.data);
      } catch (err) {
        setError('Failed to fetch turnover metrics.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="h-40 bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 animate-pulse"></div>;
  }

  if (error || !data) {
    return <div className="p-4 text-red-500 bg-red-50 dark:bg-red-950 rounded-lg">{error || 'No data available'}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Turnover Rate (Last 12m)</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{data.turnoverRate}%</h3>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Average Tenure</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">
            {data.averageTenureMonths} <span className="text-xl font-normal text-gray-500">months</span>
          </h3>
        </div>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
          <p className="text-sm font-medium text-gray-500 dark:text-slate-400">Total Terminated (Last 12m)</p>
          <h3 className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{data.totalTerminated}</h3>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 p-6 shadow-sm">
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">Headcount & Turnover Trends</h3>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.trends} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#374151" opacity={0.2} />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
              <YAxis yAxisId="left" orientation="left" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
              <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ backgroundColor: '#1E293B', borderColor: '#334155', color: '#F8FAFC', borderRadius: '8px' }}
                itemStyle={{ color: '#E2E8F0' }}
              />
              <Legend verticalAlign="top" height={36} />
              <Bar yAxisId="left" dataKey="active" name="Active Employees" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              <Bar yAxisId="right" dataKey="terminated" name="Terminated" fill="#EF4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default TurnoverMetrics;
