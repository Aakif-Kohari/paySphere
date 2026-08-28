package com.medtrack.cardiology.service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Enterprise Acute Coronary Syndrome & STEMI Interventional Service.
 *
 * Implements clinical decision algorithms for Door-to-Balloon (D2B) benchmarking,
 * Cardiac Power Output (CPO), Shock Index, TIMI STEMI risk scoring, and anticoagulation ACT tracking.
 */
public class CardiologyStemiService {

    public static class CardiacPowerResult {
        private final double cpoWatts;
        private final boolean isSevereCardiogenicShock;
        private final String hemodynamicInterpretation;

        public CardiacPowerResult(double cpoWatts, boolean isSevereCardiogenicShock, String hemodynamicInterpretation) {
            this.cpoWatts = cpoWatts;
            this.isSevereCardiogenicShock = isSevereCardiogenicShock;
            this.hemodynamicInterpretation = hemodynamicInterpretation;
        }

        public double getCpoWatts() { return cpoWatts; }
        public boolean isSevereCardiogenicShock() { return isSevereCardiogenicShock; }
        public String getHemodynamicInterpretation() { return hemodynamicInterpretation; }
    }

    public static class TimiStemiResult {
        private final int score;
        private final double predictedThirtyDayMortality;
        private final String riskTier;
        private final List<String> factorsMet;

        public TimiStemiResult(int score, double predictedThirtyDayMortality, String riskTier, List<String> factorsMet) {
            this.score = score;
            this.predictedThirtyDayMortality = predictedThirtyDayMortality;
            this.riskTier = riskTier;
            this.factorsMet = factorsMet;
        }

        public int getScore() { return score; }
        public double getPredictedThirtyDayMortality() { return predictedThirtyDayMortality; }
        public String getRiskTier() { return riskTier; }
        public List<String> getFactorsMet() { return factorsMet; }
    }

    public static class D2bMilestoneResult {
        private final int elapsedMinutes;
        private final int targetMinutes;
        private final boolean isWithinBenchmark;
        private final String currentMilestone;

        public D2bMilestoneResult(int elapsedMinutes, int targetMinutes, boolean isWithinBenchmark, String currentMilestone) {
            this.elapsedMinutes = elapsedMinutes;
            this.targetMinutes = targetMinutes;
            this.isWithinBenchmark = isWithinBenchmark;
            this.currentMilestone = currentMilestone;
        }

        public int getElapsedMinutes() { return elapsedMinutes; }
        public int getTargetMinutes() { return targetMinutes; }
        public boolean isWithinBenchmark() { return isWithinBenchmark; }
        public String getCurrentMilestone() { return currentMilestone; }
    }

    /**
     * Compute Cardiac Power Output (CPO).
     * Formula: CPO = (MAP * Cardiac Output) / 451
     */
    public CardiacPowerResult calculateCardiacPowerOutput(double map, double cardiacOutput) {
        if (map <= 0 || cardiacOutput <= 0) {
            throw new IllegalArgumentException("MAP and Cardiac Output must be positive non-zero values");
        }

        double cpo = Math.round(((map * cardiacOutput) / 451.0) * 100.0) / 100.0;
        boolean isShock = cpo < 0.6;

        String interpretation = isShock
                ? "Severely depressed cardiac power output (< 0.60 W). High risk of refractory cardiogenic shock."
                : "Adequate cardiac reserve (>= 0.60 W).";

        return new CardiacPowerResult(cpo, isShock, interpretation);
    }

    /**
     * Compute Shock Index (SI).
     * Formula: SI = Heart Rate / Systolic BP
     */
    public double calculateShockIndex(double heartRate, double systolicBp) {
        if (systolicBp <= 0) {
            throw new IllegalArgumentException("Systolic blood pressure must be greater than zero");
        }
        return Math.round((heartRate / systolicBp) * 100.0) / 100.0;
    }

    /**
     * Compute TIMI Risk Score for STEMI.
     */
    public TimiStemiResult evaluateTimiScore(int age, double systolicBp, double heartRate,
                                            String killipClass, double weightKg, boolean anteriorStElevation, boolean timeToRxOver4h) {
        int score = 0;
        List<String> factors = new ArrayList<>();

        if (age >= 75) {
            score += 3;
            factors.add("Age >= 75 (+3 pts)");
        } else if (age >= 65) {
            score += 2;
            factors.add("Age 65-74 (+2 pts)");
        }

        if (systolicBp < 100) {
            score += 3;
            factors.add("Systolic BP < 100 mmHg (+3 pts)");
        }

        if (heartRate > 100) {
            score += 2;
            factors.add("Heart Rate > 100 BPM (+2 pts)");
        }

        if (killipClass != null && !killipClass.equalsIgnoreCase("I") && !killipClass.equalsIgnoreCase("CLASS_I")) {
            score += 2;
            factors.add("Killip Class II-IV Heart Failure (+2 pts)");
        }

        if (weightKg < 67.0) {
            score += 1;
            factors.add("Weight < 67 kg (+1 pt)");
        }

        if (anteriorStElevation) {
            score += 1;
            factors.add("Anterior ST Elevation / LBBB (+1 pt)");
        }

        if (timeToRxOver4h) {
            score += 1;
            factors.add("Time to Treatment > 4h (+1 pt)");
        }

        double mortality = 0.8;
        if (score >= 8) mortality = 35.9;
        else if (score == 7) mortality = 23.4;
        else if (score == 6) mortality = 16.1;
        else if (score == 5) mortality = 12.4;
        else if (score == 4) mortality = 7.3;
        else if (score == 3) mortality = 4.4;
        else if (score == 2) mortality = 2.2;
        else if (score == 1) mortality = 1.6;

        String tier = score >= 6 ? "High / Very High Risk" : score >= 3 ? "Intermediate Risk" : "Low Risk";

        return new TimiStemiResult(score, mortality, tier, factors);
    }
}
