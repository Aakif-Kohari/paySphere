import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, CircularProgress, Paper } from '@mui/material';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useSelector } from 'react-redux';

const InviteAcceptPage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [validating, setValidating] = useState(true);
  const [inviteDetails, setInviteDetails] = useState(null);
  
  // Use redux or context depending on how auth state is managed in the app
  const isAuthenticated = useSelector((state) => state.auth?.isAuthenticated || false);

  useEffect(() => {
    if (!token) {
      toast.error('Invalid invite link');
      navigate('/');
      return;
    }
    
    validateToken(token);
  }, [token, navigate]);

  const validateToken = async (inviteToken) => {
    try {
      setValidating(true);
      const { data } = await axios.get(`/api/team/invites/validate?token=${inviteToken}`);
      setInviteDetails(data);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Invalid or expired invite link');
      navigate('/');
    } finally {
      setValidating(false);
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!isAuthenticated) {
      // Navigate to login with the return URL including token
      toast.error('Please log in or sign up to accept the invite');
      navigate(`/login?returnUrl=/invite/accept?token=${token}`);
      return;
    }

    try {
      setLoading(true);
      await axios.post(
        '/api/team/invites/accept',
        { token },
        { withCredentials: true }
      );
      toast.success('Invite accepted! Welcome to the team.');
      navigate('/dashboard'); // Or wherever appropriate
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to accept invite');
    } finally {
      setLoading(false);
    }
  };

  if (validating) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', bgcolor: 'background.default' }}>
      <Paper elevation={3} sx={{ p: 4, maxWidth: 500, width: '100%', textAlign: 'center' }}>
        <Typography variant="h4" fontWeight="bold" gutterBottom>
          You're Invited!
        </Typography>
        <Typography variant="body1" color="text.secondary" paragraph>
          You have been invited to join the team on PaySphere as a <strong>{inviteDetails?.role}</strong>.
        </Typography>
        
        <Box sx={{ mt: 4 }}>
          <Button
            variant="contained"
            color="primary"
            size="large"
            fullWidth
            onClick={handleAccept}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : (isAuthenticated ? 'Accept Invitation' : 'Login to Accept')}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default InviteAcceptPage;
