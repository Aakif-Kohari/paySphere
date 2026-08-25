/**
 * @fileoverview Document Vault Controller
 * @description Manages document categories, employee document uploads, access
 * control, versioning, sharing, expiry management, and compliance reporting.
 */

const mongoose = require('mongoose');
const {
  DocumentCategory,
  EmployeeDocument,
  DocumentAccessLog,
} = require('../models/documentVault.model');
const Employee = require('../models/employee.model');
const {
  validateFileUpload,
  computeExpiryDate,
  checkDocumentExpiry,
  checkDocumentAccess,
  findExpiringDocuments,
  computeVaultMetrics,
  complianceReport,
} = require('../utils/documentVaultUtils');
const eventBus = require('../services/event.service');
const logger = require('../utils/logger');

// ============================================================================
// Helper: log document access
// ============================================================================

async function logAccess(
  tenantId,
  documentId,
  accessedBy,
  action,
  req,
  details,
) {
  try {
    await DocumentAccessLog.create({
      tenantId,
      documentId,
      accessedBy,
      action,
      ipAddress: req.ip || '',
      userAgent: req.headers?.['user-agent'] || '',
      timestamp: new Date(),
      details: details || {},
    });
  } catch (err) {
    logger.error('Failed to log document access', {
      documentId,
      action,
      error: err.message,
    });
  }
}

// ============================================================================
// Document Categories
// ============================================================================

exports.createCategory = async (req, res, next) => {
  try {
    const {
      name,
      description,
      visibility,
      allowEmployeeUpload,
      isRequired,
      validityDays,
      allowedExtensions,
      maxFileSizeMB,
    } = req.body;

    if (!name) return res.status(400).json({ message: 'name is required' });

    const category = await DocumentCategory.create({
      tenantId: req.tenantId,
      name,
      description,
      visibility: visibility || 'Employee',
      allowEmployeeUpload: allowEmployeeUpload || false,
      isRequired: isRequired || false,
      validityDays: validityDays || 0,
      allowedExtensions: allowedExtensions || [
        'pdf',
        'jpg',
        'jpeg',
        'png',
        'doc',
        'docx',
      ],
      maxFileSizeMB: maxFileSizeMB || 10,
      createdBy: req.userId,
    });

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'DOC_CATEGORY_CREATED',
      resourceType: 'DocumentCategory',
      resourceIds: [category._id],
      details: { name, visibility, isRequired },
      req,
    });

    return res.status(201).json({ message: 'Category created', category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Category name already exists' });
    }
    return next(error);
  }
};

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await DocumentCategory.find({ tenantId: req.tenantId })
      .populate('createdBy', 'fullName')
      .sort({ name: 1 })
      .lean();
    return res.status(200).json({ categories });
  } catch (error) {
    return next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }

    const category = await DocumentCategory.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!category)
      return res.status(404).json({ message: 'Category not found' });

    const editable = [
      'name',
      'description',
      'visibility',
      'allowEmployeeUpload',
      'isRequired',
      'validityDays',
      'allowedExtensions',
      'maxFileSizeMB',
      'isActive',
    ];
    for (const field of editable) {
      if (req.body[field] !== undefined) category[field] = req.body[field];
    }

    await category.save();
    return res.status(200).json({ message: 'Category updated', category });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Category name already exists' });
    }
    return next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid category ID' });
    }

    // Check if any documents exist in this category
    const docCount = await EmployeeDocument.countDocuments({
      tenantId: req.tenantId,
      categoryId: req.params.id,
    });
    if (docCount > 0) {
      return res.status(400).json({
        message: `Cannot delete category with ${docCount} existing documents`,
      });
    }

    const category = await DocumentCategory.findOneAndDelete({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!category)
      return res.status(404).json({ message: 'Category not found' });

    return res.status(200).json({ message: 'Category deleted' });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Employee Documents
// ============================================================================

exports.uploadDocument = async (req, res, next) => {
  try {
    const {
      employeeId,
      categoryId,
      title,
      description,
      tags,
      fileUrl,
      fileName,
      fileSize,
      mimeType,
    } = req.body;

    if (!employeeId || !categoryId || !title || !fileUrl || !fileName) {
      return res.status(400).json({
        message:
          'employeeId, categoryId, title, fileUrl, and fileName are required',
      });
    }

    if (
      !mongoose.isValidObjectId(employeeId) ||
      !mongoose.isValidObjectId(categoryId)
    ) {
      return res
        .status(400)
        .json({ message: 'Invalid employeeId or categoryId' });
    }

    // Verify employee exists
    const employee = await Employee.findOne({
      _id: employeeId,
      tenantId: req.tenantId,
    }).select('_id fullName');
    if (!employee)
      return res.status(404).json({ message: 'Employee not found' });

    // Verify category exists
    const category = await DocumentCategory.findOne({
      _id: categoryId,
      tenantId: req.tenantId,
    });
    if (!category)
      return res.status(404).json({ message: 'Category not found' });

    // Validate file against category
    const fileObj = {
      originalname: fileName,
      size: fileSize || 0,
      mimetype: mimeType || '',
    };
    const validation = validateFileUpload(fileObj, category);
    if (!validation.valid) {
      return res.status(400).json({ message: validation.error });
    }

    // Compute expiry
    const expiresAt = computeExpiryDate(new Date(), category.validityDays);

    // Create document with first version
    const doc = await EmployeeDocument.create({
      tenantId: req.tenantId,
      employeeId,
      categoryId,
      title,
      description: description || '',
      fileUrl,
      fileName,
      fileSize: fileSize || 0,
      mimeType: mimeType || '',
      expiresAt,
      status: 'Active',
      reviewStatus: category.isRequired ? 'Pending' : 'None',
      versions: [
        {
          versionNumber: 1,
          fileUrl,
          fileSize: fileSize || 0,
          mimeType: mimeType || '',
          uploadedBy: req.userId,
          uploadedAt: new Date(),
          changeNote: 'Initial upload',
        },
      ],
      currentVersion: 1,
      tags: tags || [],
      uploadedBy: req.userId,
      uploadedAt: new Date(),
    });

    await logAccess(req.tenantId, doc._id, req.userId, 'Upload', req, {
      title,
      categoryName: category.name,
    });

    eventBus.emitAuditLog({
      userId: req.userId,
      action: 'DOC_UPLOADED',
      resourceType: 'EmployeeDocument',
      resourceIds: [doc._id],
      details: { title, employeeId, categoryName: category.name },
      req,
    });

    return res
      .status(201)
      .json({ message: 'Document uploaded', document: doc });
  } catch (error) {
    return next(error);
  }
};

exports.getDocuments = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId, isDeleted: false };
    if (
      req.query.employeeId &&
      mongoose.isValidObjectId(req.query.employeeId)
    ) {
      filter.employeeId = req.query.employeeId;
    }
    if (
      req.query.categoryId &&
      mongoose.isValidObjectId(req.query.categoryId)
    ) {
      filter.categoryId = req.query.categoryId;
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      filter.$or = [
        { title: new RegExp(req.query.search, 'i') },
        { tags: new RegExp(req.query.search, 'i') },
      ];
    }

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

    const [documents, total] = await Promise.all([
      EmployeeDocument.find(filter)
        .populate('employeeId', 'fullName department')
        .populate('categoryId', 'name visibility')
        .sort({ uploadedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmployeeDocument.countDocuments(filter),
    ]);

    return res.status(200).json({
      documents,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
};

exports.getDocumentById = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }

    const doc = await EmployeeDocument.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      isDeleted: false,
    })
      .populate('employeeId', 'fullName department')
      .populate('categoryId', 'name visibility')
      .populate('uploadedBy', 'fullName')
      .lean();

    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Check expiry
    const expiry = checkDocumentExpiry(doc);

    // Log view access
    await logAccess(req.tenantId, doc._id, req.userId, 'View', req);

    return res.status(200).json({ document: doc, expiry });
  } catch (error) {
    return next(error);
  }
};

exports.updateDocument = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }

    const doc = await EmployeeDocument.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      isDeleted: false,
    });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const { title, description, tags, status } = req.body;
    if (title !== undefined) doc.title = title;
    if (description !== undefined) doc.description = description;
    if (tags !== undefined) doc.tags = tags;
    if (status) doc.status = status;

    // Version update if new file provided
    if (req.body.fileUrl && req.body.fileName) {
      const newVersion = doc.currentVersion + 1;
      doc.versions.push({
        versionNumber: newVersion,
        fileUrl: req.body.fileUrl,
        fileSize: req.body.fileSize || 0,
        mimeType: req.body.mimeType || '',
        uploadedBy: req.userId,
        uploadedAt: new Date(),
        changeNote: req.body.changeNote || `Version ${newVersion}`,
      });
      doc.fileUrl = req.body.fileUrl;
      doc.fileName = req.body.fileName;
      doc.fileSize = req.body.fileSize || doc.fileSize;
      doc.mimeType = req.body.mimeType || doc.mimeType;
      doc.currentVersion = newVersion;
    }

    await doc.save();

    await logAccess(req.tenantId, doc._id, req.userId, 'Update', req, {
      updatedFields: Object.keys(req.body),
    });

    return res.status(200).json({ message: 'Document updated', document: doc });
  } catch (error) {
    return next(error);
  }
};

exports.softDeleteDocument = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }

    const doc = await EmployeeDocument.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      isDeleted: false,
    });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    doc.isDeleted = true;
    doc.deletedAt = new Date();
    doc.deletedBy = req.userId;
    doc.status = 'Archived';
    await doc.save();

    await logAccess(req.tenantId, doc._id, req.userId, 'Delete', req);

    return res.status(200).json({ message: 'Document archived' });
  } catch (error) {
    return next(error);
  }
};

exports.restoreDocument = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }

    const doc = await EmployeeDocument.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      isDeleted: true,
    });
    if (!doc)
      return res.status(404).json({ message: 'Archived document not found' });

    doc.isDeleted = false;
    doc.deletedAt = null;
    doc.deletedBy = null;
    doc.status = 'Active';
    await doc.save();

    await logAccess(req.tenantId, doc._id, req.userId, 'Restore', req);

    return res
      .status(200)
      .json({ message: 'Document restored', document: doc });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Sharing
// ============================================================================

exports.shareDocument = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }

    const { userId, permission } = req.body;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(400).json({ message: 'Valid userId is required' });
    }
    if (!['View', 'Download', 'Edit'].includes(permission)) {
      return res
        .status(400)
        .json({ message: 'permission must be View, Download, or Edit' });
    }

    const doc = await EmployeeDocument.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
      isDeleted: false,
    });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    // Check if already shared
    const existing = doc.sharedWith.find(
      (s) => String(s.userId) === String(userId),
    );
    if (existing) {
      existing.permission = permission;
      existing.sharedAt = new Date();
      existing.sharedBy = req.userId;
    } else {
      doc.sharedWith.push({
        userId,
        permission,
        sharedAt: new Date(),
        sharedBy: req.userId,
      });
    }

    await doc.save();

    await logAccess(req.tenantId, doc._id, req.userId, 'Share', req, {
      sharedWith: userId,
      permission,
    });

    return res.status(200).json({ message: 'Document shared', document: doc });
  } catch (error) {
    return next(error);
  }
};

exports.removeShare = async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: 'Invalid document ID' });
    }

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ message: 'userId is required' });

    const doc = await EmployeeDocument.findOne({
      _id: req.params.id,
      tenantId: req.tenantId,
    });
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    doc.sharedWith = doc.sharedWith.filter(
      (s) => String(s.userId) !== String(userId),
    );
    await doc.save();

    return res.status(200).json({ message: 'Share removed' });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Compliance & Expiry
// ============================================================================

exports.getExpiringDocuments = async (req, res, next) => {
  try {
    const horizonDays = parseInt(req.query.horizonDays, 10) || 30;

    const documents = await EmployeeDocument.find({
      tenantId: req.tenantId,
      isDeleted: false,
      expiresAt: { $ne: null },
      status: 'Active',
    })
      .populate('employeeId', 'fullName department')
      .populate('categoryId', 'name')
      .lean();

    const expiring = findExpiringDocuments(documents, horizonDays);

    return res.status(200).json({ expiring, horizonDays });
  } catch (error) {
    return next(error);
  }
};

exports.markExpired = async (req, res, next) => {
  try {
    const now = new Date();
    const result = await EmployeeDocument.updateMany(
      {
        tenantId: req.tenantId,
        isDeleted: false,
        status: 'Active',
        $and: [{ expiresAt: { $lte: now } }, { expiresAt: { $ne: null } }],
      },
      { $set: { status: 'Expired' } },
    );

    return res.status(200).json({
      message: 'Expiry check complete',
      expired: result.modifiedCount,
    });
  } catch (error) {
    return next(error);
  }
};

exports.getComplianceReport = async (req, res, next) => {
  try {
    const categories = await DocumentCategory.find({
      tenantId: req.tenantId,
      isRequired: true,
      isActive: true,
    }).lean();

    if (categories.length === 0) {
      return res
        .status(200)
        .json({ report: [], message: 'No required categories configured' });
    }

    const documents = await EmployeeDocument.find({
      tenantId: req.tenantId,
      isDeleted: false,
      status: 'Active',
    }).lean();

    const employees = await Employee.find({
      tenantId: req.tenantId,
      isActive: true,
    })
      .select('_id fullName department')
      .lean();

    const report = complianceReport(documents, categories, employees);

    return res.status(200).json({
      report,
      totalRequired: categories.length,
      totalEmployees: employees.length,
      compliantCount: employees.length - report.length,
      complianceRate:
        employees.length > 0
          ? Math.round(
              ((employees.length - report.length) / employees.length) * 100,
            )
          : 100,
    });
  } catch (error) {
    return next(error);
  }
};

// ============================================================================
// Dashboard & Analytics
// ============================================================================

exports.getDashboard = async (req, res, next) => {
  try {
    const [documents, categories] = await Promise.all([
      EmployeeDocument.find({
        tenantId: req.tenantId,
        isDeleted: false,
      }).lean(),
      DocumentCategory.find({ tenantId: req.tenantId, isActive: true }).lean(),
    ]);

    const metrics = computeVaultMetrics(documents, categories);

    // Expiring in 30 days
    const expiring = findExpiringDocuments(documents, 30);

    // Pending reviews
    const pendingReviews = await EmployeeDocument.countDocuments({
      tenantId: req.tenantId,
      reviewStatus: 'Pending',
      isDeleted: false,
    });

    return res.status(200).json({
      metrics,
      expiringCount: expiring.length,
      pendingReviews,
    });
  } catch (error) {
    return next(error);
  }
};

exports.getAccessLogs = async (req, res, next) => {
  try {
    const filter = { tenantId: req.tenantId };
    if (
      req.query.documentId &&
      mongoose.isValidObjectId(req.query.documentId)
    ) {
      filter.documentId = req.query.documentId;
    }
    if (
      req.query.accessedBy &&
      mongoose.isValidObjectId(req.query.accessedBy)
    ) {
      filter.accessedBy = req.query.accessedBy;
    }
    if (req.query.action) filter.action = req.query.action;

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);

    const [logs, total] = await Promise.all([
      DocumentAccessLog.find(filter)
        .populate('accessedBy', 'fullName')
        .populate('documentId', 'title')
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      DocumentAccessLog.countDocuments(filter),
    ]);

    return res.status(200).json({
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return next(error);
  }
};
