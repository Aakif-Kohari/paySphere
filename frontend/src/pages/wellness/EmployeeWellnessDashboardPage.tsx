import React, { useState, useMemo } from "react";
import { Heart, Brain, Activity, Users, Search, Download, ChevronRight, CheckCircle2, AlertTriangle, Target, ShieldCheck, X, Smile, Frown, Stethoscope, TrendingUp, TrendingDown, Pill } from "lucide-react";

interface MentalHealthRecord { id: string; employeeName: string; employeeId: string; department: string; screeningScore: number; riskLevel: string; lastSession: string; therapistSessions: number; mood: string; stressLevel: number; burnoutRisk: string; eapEnrolled: boolean; }
interface WellnessChallenge { id: string; challengeName: string; category: string; participants: number; targetParticipants: number; startDate: string; endDate: string; completionRate: number; status: string; prize: string; }
interface EAPRecord { id: string; employeeName: string; employeeId: string; department: string; sessionType: string; sessionsAttended: number; lastVisit: string; referralSource: string; satisfaction: number; status: string; costPerSession: number; }
interface HealthMetric { id: string; employeeName: string; employeeId: string; department: string; age: number; bmi: number; bloodPressure: string; cholesterol: number; glucose: number; riskScore: number; riskCategory: string; lastCheckup: string; smoker: boolean; exerciseDaysPerWeek: number; }
interface WellnessStat { id: string; metric: string; value: number; previousValue: number; trend: string; category: string; target: number; unit: string; }

