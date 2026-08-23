const mongoose = require('mongoose');

const HolidaySchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    enum: ['gazetted', 'restricted', 'half-day'],
    required: true,
    default: 'gazetted',
  },
});

const HolidayCalendarSchema = new mongoose.Schema(
  {
    tenantId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tenant',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    assignmentType: {
      type: String,
      enum: ['global', 'department', 'location'],
      required: true,
      default: 'global',
    },
    assignedTo: [
      {
        type: mongoose.Schema.Types.ObjectId,
        // Could refer to Department or Location based on assignmentType
      },
    ],
    holidays: [HolidaySchema],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model('HolidayCalendar', HolidayCalendarSchema);
