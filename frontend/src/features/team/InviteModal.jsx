import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Typography,
} from '@mui/material';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const InviteModal = ({ open, onClose, onInviteSent }) => {
  const [email, setEmail] = useState('');
  const [roleId, setRoleId] = useState('');
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchRoles();
    }
  }, [open]);

  const fetchRoles = async () => {
    try {
      setRolesLoading(true);
      const { data } = await axios.get('/api/roles', { withCredentials: true });
      setRoles(data);
      if (data.length > 0) {
        setRoleId(data[0]._id);
      }
    } catch (error) {
      toast.error('Failed to fetch roles');
    } finally {
      setRolesLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !roleId) {
      toast.error('Please fill all fields');
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        '/api/team/invites',
        { email, roleId },
        { withCredentials: true }
      );
      toast.success('Invite sent successfully');
      onInviteSent();
      onClose();
      setEmail('');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to send invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Invite Team Member</DialogTitle>
      <form onSubmit={handleSubmit}>
        <DialogContent dividers>
          <TextField
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <TextField
            select
            margin="dense"
            label="Role"
            fullWidth
            required
            value={roleId}
            onChange={(e) => setRoleId(e.target.value)}
            disabled={rolesLoading}
            sx={{ mt: 2 }}
          >
            {roles.map((role) => (
              <MenuItem key={role._id} value={role._id}>
                {role.name}
              </MenuItem>
            ))}
          </TextField>
          {rolesLoading && <CircularProgress size={24} sx={{ mt: 2 }} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={24} /> : 'Send Invite'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
};

export default InviteModal;
