import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  IconButton,
  CircularProgress,
} from '@mui/material';
import { Trash2, UserPlus, ShieldOff } from 'lucide-react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import InviteModal from './InviteModal';

const TeamManagement = () => {
  const [tabIndex, setTabIndex] = useState(0);
  const [members, setMembers] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [membersRes, invitesRes] = await Promise.all([
        axios.get('/api/team/members', { withCredentials: true }),
        axios.get('/api/team/invites', { withCredentials: true }),
      ]);
      setMembers(membersRes.data);
      setInvites(invitesRes.data);
    } catch (error) {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (memberId, roleName) => {
    if (roleName === 'OWNER') {
      toast.error('Cannot deactivate a workspace owner');
      return;
    }
    if (!window.confirm('Are you sure you want to deactivate this member?')) return;

    try {
      await axios.post(`/api/team/members/${memberId}/deactivate`, {}, { withCredentials: true });
      toast.success('Member deactivated successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to deactivate member');
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    if (!window.confirm('Are you sure you want to revoke this invite?')) return;
    try {
      await axios.post(`/api/team/invites/${inviteId}/revoke`, {}, { withCredentials: true });
      toast.success('Invite revoked successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to revoke invite');
    }
  };

  return (
    <Box sx={{ p: 4, maxWidth: 1200, mx: 'auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight="bold">
          Team Management
        </Typography>
        <Button
          variant="contained"
          startIcon={<UserPlus size={18} />}
          onClick={() => setInviteModalOpen(true)}
        >
          Invite Member
        </Button>
      </Box>

      <Paper sx={{ width: '100%', mb: 2 }}>
        <Tabs
          value={tabIndex}
          onChange={(e, val) => setTabIndex(val)}
          indicatorColor="primary"
          textColor="primary"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label={`Active Members (${members.filter(m => m.isActive).length})`} />
          <Tab label={`Pending Invites (${invites.filter(i => i.status === 'pending').length})`} />
        </Tabs>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : tabIndex === 0 ? (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {members.map((member) => (
                  <TableRow key={member._id}>
                    <TableCell>{member.fullName}</TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>{member.role?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      <Chip
                        label={member.isActive ? 'Active' : 'Inactive'}
                        color={member.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell align="right">
                      {member.isActive && member.role?.name !== 'OWNER' && (
                        <IconButton
                          color="error"
                          onClick={() => handleDeactivate(member._id, member.role?.name)}
                          title="Deactivate Member"
                        >
                          <ShieldOff size={18} />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Sent On</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite._id}>
                    <TableCell>{invite.email}</TableCell>
                    <TableCell>{invite.role?.name || 'Unknown'}</TableCell>
                    <TableCell>
                      <Chip
                        label={invite.status}
                        color={invite.status === 'pending' ? 'warning' : invite.status === 'accepted' ? 'success' : 'error'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{new Date(invite.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell align="right">
                      {invite.status === 'pending' && (
                        <IconButton
                          color="error"
                          onClick={() => handleRevokeInvite(invite._id)}
                          title="Revoke Invite"
                        >
                          <Trash2 size={18} />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {invites.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} align="center" sx={{ py: 3 }}>
                      No invites found
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <InviteModal
        open={inviteModalOpen}
        onClose={() => setInviteModalOpen(false)}
        onInviteSent={fetchData}
      />
    </Box>
  );
};

export default TeamManagement;
