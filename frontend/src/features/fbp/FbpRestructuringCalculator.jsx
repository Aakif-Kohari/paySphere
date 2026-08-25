import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  Slider,
  Typography,
  Paper,
} from '@mui/material';
import { toast } from 'react-hot-toast';

export default function FbpRestructuringCalculator() {
  const [submitting, setSubmitting] = useState(false);
  // Hardcoded for demo purposes based on requirements
  const [totalCtc] = useState(120000); // 1.2L gross monthly
  const [basic] = useState(60000); // 50% fixed
  const [hra] = useState(24000); // 40% of basic fixed

  // Flexible components
  const [mealVoucher, setMealVoucher] = useState(0); // Cap 3000
  const [internet, setInternet] = useState(0); // Cap 1500
  const [specialAllowance, setSpecialAllowance] = useState(36000); // Residual

  const [simulation, setSimulation] = useState(null);

  const simulateImpact = async () => {
    try {
      // Local simulation for demo
      const nonTaxable = mealVoucher + internet;
      const taxable = totalCtc - nonTaxable;
      const estimatedTax = taxable * 0.1; // 10% dummy flat tax on taxable
      setSimulation({
        projectedNetMonthly: totalCtc - estimatedTax,
        monthlyTax: estimatedTax,
        nonTaxableExemptionsMonthly: nonTaxable,
      });
    } catch (err) {
      console.error(err);
    }
  };

  const handleMealChange = (e, val) => {
    setMealVoucher(val);
    recalculateResidual(val, internet);
  };

  const handleInternetChange = (e, val) => {
    setInternet(val);
    recalculateResidual(mealVoucher, val);
  };

  const recalculateResidual = (newMeal, newInternet) => {
    const fixed = basic + hra;
    const flexibleSum = newMeal + newInternet;
    const newSpecial = totalCtc - (fixed + flexibleSum);

    if (newSpecial < 0) {
      toast.error('Allocated components exceed CTC');
      return;
    }

    setSpecialAllowance(newSpecial);
  };

  useEffect(() => {
    // Debounce the simulation call
    const timer = setTimeout(() => {
      simulateImpact();
    }, 500);
    return () => clearTimeout(timer);
  }, [
    mealVoucher,
    internet,
    specialAllowance,
    totalCtc,
    basic,
    hra,
    simulateImpact,
  ]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // In real app, post to /declare endpoint
      toast.success('Declaration submitted for HR approval');
    } catch {
      console.error('Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  const isInvalid =
    specialAllowance < 0 ||
    basic + hra + mealVoucher + internet + specialAllowance !== totalCtc;

  return (
    <Box p={3}>
      <Typography variant="h4" gutterBottom>
        FBP Restructuring Calculator
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="Adjust Flexible Components" />
            <Divider />
            <CardContent>
              <Typography gutterBottom>
                Total CTC (Monthly): ₹{totalCtc.toLocaleString()}
              </Typography>
              <Typography gutterBottom color="textSecondary">
                Fixed Basic: ₹{basic.toLocaleString()} | Fixed HRA: ₹
                {hra.toLocaleString()}
              </Typography>

              <Box mt={4}>
                <Typography gutterBottom>
                  Meal Vouchers (Cap: ₹3,000)
                </Typography>
                <Slider
                  value={mealVoucher}
                  onChange={handleMealChange}
                  min={0}
                  max={3000}
                  step={500}
                  valueLabelDisplay="auto"
                />
              </Box>

              <Box mt={4}>
                <Typography gutterBottom>
                  Internet Allowance (Cap: ₹1,500)
                </Typography>
                <Slider
                  value={internet}
                  onChange={handleInternetChange}
                  min={0}
                  max={1500}
                  step={250}
                  valueLabelDisplay="auto"
                />
              </Box>

              <Box mt={4}>
                <Typography gutterBottom>
                  Special Allowance (Residual): ₹
                  {specialAllowance.toLocaleString()}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="Tax Simulation" />
            <Divider />
            <CardContent>
              {simulation ? (
                <Box>
                  <Typography variant="h6" color="primary" gutterBottom>
                    Net Take-Home: ₹
                    {simulation.projectedNetMonthly.toLocaleString()}
                  </Typography>
                  <Typography gutterBottom>
                    Estimated Tax: ₹{simulation.monthlyTax.toLocaleString()}
                  </Typography>
                  <Typography gutterBottom>
                    Tax Exemptions: ₹
                    {simulation.nonTaxableExemptionsMonthly.toLocaleString()}
                  </Typography>
                </Box>
              ) : (
                <Typography>Calculating...</Typography>
              )}

              <Box mt={4}>
                <Button
                  fullWidth
                  variant="contained"
                  color="primary"
                  onClick={handleSubmit}
                  disabled={submitting || isInvalid}
                >
                  Submit Declaration
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
