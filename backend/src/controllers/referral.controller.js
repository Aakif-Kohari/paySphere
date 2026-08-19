/**
 * @fileoverview Referral Controller
 * @description Manages referral submissions, hiring pipeline updates, and payout processing.
 * Issue: #1208
 */
const { ReferralProgram, ReferralCandidate, ReferralPayout } = require('../models/referral.model');
const Employee = require('../models/employee.model');
const { processMilestonePayouts } = require('../utils/referralPayoutEngine.utils');

exports.getActivePrograms = async (req, res, next) => {
    try {
        const programs = await ReferralProgram.find({ tenantId: req.tenantId, isActive: true });
        res.status(200).json({ programs });
    } catch (error) { next(error); }
};

exports.submitReferral = async (req, res, next) => {
    try {
        const { programId, candidateName, candidateEmail, candidatePhone, resumeUrl } = req.body;
        const referrer = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });
        if (!referrer) return res.status(404).json({ message: 'Employee profile not found' });

        const candidate = await ReferralCandidate.create({
            tenantId: req.tenantId,
            programId,
            referrerId: referrer._id,
            candidateName,
            candidateEmail,
            candidatePhone,
            resumeUrl
        });

        res.status(201).json({ message: 'Referral submitted successfully', candidate });
    } catch (error) { next(error); }
};

exports.getMyReferrals = async (req, res, next) => {
    try {
        const referrer = await Employee.findOne({ userId: req.userId, tenantId: req.tenantId });
        if (!referrer) return res.status(404).json({ message: 'Employee profile not found' });

        const referrals = await ReferralCandidate.find({ tenantId: req.tenantId, referrerId: referrer._id })
            .populate('programId', 'title bountyAmount')
            .sort({ createdAt: -1 });

        // Fetch associated payouts for each referral
        const payouts = await ReferralPayout.find({ tenantId: req.tenantId, referrerId: referrer._id });
        const payoutMap = new Map(payouts.map(p => [p.candidateId.toString(), p]));

        const data = referrals.map(r => ({
            ...r.toObject(),
            payout: payoutMap.get(r._id.toString()) || null
        }));

        res.status(200).json({ referrals: data });
    } catch (error) { next(error); }
};

exports.updateCandidateStatus = async (req, res, next) => {
    try {
        const { status, hiredEmployeeId } = req.body;
        const candidate = await ReferralCandidate.findById(req.params.id);
        if (!candidate) return res.status(404).json({ message: 'Candidate not found' });

        candidate.status = status;
        if (status === 'Hired' && hiredEmployeeId) {
            candidate.hiredEmployeeId = hiredEmployeeId;
            candidate.hiredAt = new Date();

            // Create initial payout milestone (Joining Bonus)
            const program = await ReferralProgram.findById(candidate.programId);
            if (program) {
                const joiningSplit = program.milestoneSplits.find(m => m.trigger === 'HIRED') || { percentage: 50 };
                const amount = (program.bountyAmount * joiningSplit.percentage) / 100;

                await ReferralPayout.create({
                    tenantId: req.tenantId,
                    candidateId: candidate._id,
                    referrerId: candidate.referrerId,
                    milestoneLabel: 'Joining Bonus',
                    amount,
                    status: 'Approved' // Ready for next payroll
                });

                // Create pending probation milestone
                const retentionSplit = program.milestoneSplits.find(m => m.trigger === 'PROBATION_COMPLETE') || { percentage: 50 };
                const retAmount = (program.bountyAmount * retentionSplit.percentage) / 100;

                await ReferralPayout.create({
                    tenantId: req.tenantId,
                    candidateId: candidate._id,
                    referrerId: candidate.referrerId,
                    milestoneLabel: 'Probation Completion Bonus',
                    amount: retAmount,
                    status: 'Pending' // Waits for engine
                });
            }
        }

        await candidate.save();
        res.status(200).json({ message: 'Status updated', candidate });
    } catch (error) { next(error); }
};

exports.runPayoutEngine = async (req, res, next) => {
    try {
        const result = await processMilestonePayouts(req.tenantId);
        res.status(200).json({ message: 'Payout engine executed', result });
    } catch (error) { next(error); }
};

exports.getAdminPipeline = async (req, res, next) => {
    try {
        const candidates = await ReferralCandidate.find({ tenantId: req.tenantId })
            .populate('referrerId', 'fullName department')
            .populate('programId', 'title')
            .sort({ createdAt: -1 });
        res.status(200).json({ candidates });
    } catch (error) { next(error); }
};
