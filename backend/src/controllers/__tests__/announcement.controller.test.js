const {
  createAnnouncement,
  getAnnouncements,
  deleteAnnouncement,
} = require('../announcement.controller');
const Announcement = require('../../models/announcement.model');
const mongoose = require('mongoose');

jest.mock('../../models/announcement.model');
jest.mock('../../services/event.service', () => ({
  emit: jest.fn(),
}));

describe('Announcement Controller', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      query: {},
      params: {},
      userId: new mongoose.Types.ObjectId().toString(),
      tenantId: new mongoose.Types.ObjectId().toString(),
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    next = jest.fn();
  });

  describe('createAnnouncement', () => {
    it('should return 400 if title or content is missing', async () => {
      req.body = { title: '   ' };
      await createAnnouncement(req, res, next);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ message: 'Announcement title is required' });
    });

    it('should create formatted rich text announcement', async () => {
      req.body = {
        title: 'Company Picnic',
        content: '<h1>Join us!</h1><p>Event details <a href="https://example.com">here</a>.</p>',
        category: 'event',
        priority: 'high',
        isPinned: true,
      };

      const mockAnnouncement = {
        _id: new mongoose.Types.ObjectId().toString(),
        title: 'Company Picnic',
        content: '<h1>Join us!</h1><p>Event details <a href="https://example.com">here</a>.</p>',
        category: 'event',
        priority: 'high',
        isPinned: true,
      };

      Announcement.create.mockResolvedValue(mockAnnouncement);

      await createAnnouncement(req, res, next);

      expect(Announcement.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Company Picnic',
          category: 'event',
          isPinned: true,
        })
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Announcement published successfully',
        announcement: mockAnnouncement,
      });
    });
  });

  describe('getAnnouncements', () => {
    it('should fetch announcements ordered by pinned status and creation date', async () => {
      const mockAnnouncements = [
        { _id: 'ann1', title: 'Pinned Post', isPinned: true },
        { _id: 'ann2', title: 'Regular Post', isPinned: false },
      ];

      Announcement.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockResolvedValue(mockAnnouncements),
        }),
      });

      await getAnnouncements(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ announcements: mockAnnouncements });
    });
  });

  describe('deleteAnnouncement', () => {
    it('should return 404 if announcement not found', async () => {
      req.params = { id: 'ann1' };
      Announcement.findOneAndDelete.mockResolvedValue(null);

      await deleteAnnouncement(req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: 'Announcement not found' });
    });

    it('should delete existing announcement', async () => {
      req.params = { id: 'ann1' };
      Announcement.findOneAndDelete.mockResolvedValue({ _id: 'ann1' });

      await deleteAnnouncement(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Announcement deleted successfully' });
    });
  });
});
