import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  useTheme,
} from '@mui/material';
import { Download as DownloadIcon } from '@mui/icons-material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ComposedChart,
} from 'recharts';
import api from '../services/api';
import { useAppStore } from '../store/useAppStore';

const EmployeeCompensationTimeline = () => {
  const theme = useTheme();
  const user = useAppStore((state) => state.user);

  const [financialYear, setFinancialYear] = useState('2023');
  const [loading, setLoading] = useState(false);
  const [timelineData, setTimelineData] = useState([]);
  const [ytdSummary, setYtdSummary] = useState(null);
  const [error, setError] = useState('');

  const employeeId = user?.employeeId || user?._id;

  useEffect(() => {
    if (employeeId) {
      fetchData();
    }
  }, [employeeId, financialYear]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');

      const [timelineRes, ytdRes] = await Promise.all([
        api.get(`/compensation/${employeeId}/timeline`),
        api.get(
          `/compensation/${employeeId}/ytd?financialYearStart=${financialYear}`,
        ),
      ]);

      if (timelineRes.data?.success) {
        setTimelineData(timelineRes.data.data.timeline || []);
      }
      if (ytdRes.data?.success) {
        setYtdSummary(ytdRes.data.data);
      }
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || 'Failed to fetch compensation data',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      const res = await api.get(
        `/compensation/${employeeId}/statement?financialYearStart=${financialYear}`,
        {
          responseType: 'blob',
        },
      );

      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute(
        'download',
        `Compensation_Statement_${financialYear}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);
    } catch (err) {
      console.error('Download failed', err);
    }
  };

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: ytdSummary?.currency || 'INR',
      maximumFractionDigits: 0,
    }).format(value || 0);
  };

  if (loading && !timelineData.length) {
    return (
      <Box display="flex" justifyContent="center" mt={4}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box p={3} maxWidth="1200px" margin="0 auto">
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={4}
      >
        <Typography variant="h4" fontWeight="bold">
          Compensation Timeline
        </Typography>

        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Financial Year</InputLabel>
            <Select
              value={financialYear}
              label="Financial Year"
              onChange={(e) => setFinancialYear(e.target.value)}
            >
              <MenuItem value="2022">2022-2023</MenuItem>
              <MenuItem value="2023">2023-2024</MenuItem>
              <MenuItem value="2024">2024-2025</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleDownload}
            sx={{
              background: 'linear-gradient(45deg, #3b82f6 30%, #2dd4bf 90%)',
              color: 'white',
              boxShadow: '0 3px 5px 2px rgba(59, 130, 246, .3)',
            }}
          >
            Download Statement
          </Button>
        </Box>
      </Box>

      {error && (
        <Typography color="error" mb={2}>
          {error}
        </Typography>
      )}

      {/* YTD Summary Cards */}
      {ytdSummary && (
        <Grid container spacing={3} mb={4}>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(59, 130, 246, 0.1)'
                    : '#eff6ff',
                border: '1px solid #bfdbfe',
              }}
            >
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  YTD Gross Earnings
                </Typography>
                <Typography variant="h5" color="primary" fontWeight="bold">
                  {formatCurrency(ytdSummary.grossEarnings)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(239, 68, 68, 0.1)'
                    : '#fef2f2',
                border: '1px solid #fecaca',
              }}
            >
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  YTD Deductions
                </Typography>
                <Typography variant="h5" color="error" fontWeight="bold">
                  {formatCurrency(ytdSummary.totalDeductions)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card
              sx={{
                bgcolor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(16, 185, 129, 0.1)'
                    : '#ecfdf5',
                border: '1px solid #a7f3d0',
              }}
            >
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  YTD Net Take-Home
                </Typography>
                <Typography
                  variant="h5"
                  sx={{ color: '#10b981' }}
                  fontWeight="bold"
                >
                  {formatCurrency(ytdSummary.netPay)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Charts */}
      <Grid container spacing={4}>
        {/* CTC vs Net Pay Chart */}
        <Grid item xs={12}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" mb={2}>
                CTC vs Actual Net Pay
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="netPay"
                      name="Actual Net Pay"
                      fill="#8884d8"
                      stroke="#8884d8"
                      fillOpacity={0.3}
                    />
                    <Line
                      type="stepAfter"
                      dataKey="ctc"
                      name="Fixed CTC"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Components Breakdown */}
        <Grid item xs={12}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" mb={2}>
                Earnings & Deductions Breakdown
              </Typography>
              <Box height={300}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={timelineData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="period" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(value)} />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="baseSalary"
                      stackId="1"
                      name="Base Salary"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                    />
                    <Area
                      type="monotone"
                      dataKey="bonus"
                      stackId="1"
                      name="Bonus"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                    />
                    <Area
                      type="monotone"
                      dataKey="overtimePay"
                      stackId="1"
                      name="Overtime"
                      stroke="#10b981"
                      fill="#10b981"
                    />
                    <Area
                      type="monotone"
                      dataKey="deductions"
                      stackId="2"
                      name="Deductions"
                      stroke="#ef4444"
                      fill="#ef4444"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EmployeeCompensationTimeline;
