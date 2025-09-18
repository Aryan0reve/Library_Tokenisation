import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const [storage, setStorage] = useState(null);
  const [pendingRequest, setPendingRequest] = useState(false);
  const [loading, setLoading] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    if (user) {
      fetchStorageData();
      
      // Initialize socket connection
      const socket = io('http://localhost:5000');
      
      socket.on('connect', () => {
        console.log('Connected to server');
      });

      socket.on('disconnect', () => {
        console.log('Disconnected from server');
      });

      socket.on('connect_error', (error) => {
        console.error('Socket connection error:', error);
      });
      
      // Listen for storage assignment
      socket.on('storage-assigned', (data) => {
        console.log('Storage assigned event:', data);
        if (data.studentId === user.id) {
          setStorage({
            boxNumber: data.boxNumber,
            accessCode: data.accessCode,
            occupiedAt: data.occupiedAt,
            isOccupied: true
          });
          setPendingRequest(false);
          toast.success(`Storage box ${data.boxNumber} assigned! Your access code is: ${data.accessCode}`, {
            autoClose: 8000
          });
        }
      });

      // Listen for storage release
      socket.on('storage-released', (data) => {
        console.log('Storage released event:', data);
        if (data.studentId === user.id) {
          setStorage(null);
          toast.info(`Storage box ${data.boxNumber} has been released`);
        }
      });

      return () => {
        socket.disconnect();
      };
    }
  }, [user]);

  const fetchStorageData = async () => {
    try {
      console.log('Fetching storage data for user:', user);
      const response = await axios.get('http://localhost:5000/api/student/my-storage');
      console.log('Storage data response:', response.data);
      setStorage(response.data.storage);
      setPendingRequest(response.data.pendingRequest);
    } catch (error) {
      console.error('Error fetching storage data:', error.response || error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        logout();
      } else if (error.response?.status === 500) {
        toast.error('Server error. Please try again later.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to fetch storage data');
      }
    }
  };

  const requestStorage = async () => {
    if (!user) {
      toast.error('User not authenticated');
      return;
    }

    setLoading(true);
    try {
      console.log('Requesting storage for user:', user.email);
      const response = await axios.post('http://localhost:5000/api/student/request-storage');
      console.log('Request storage response:', response.data);
      setPendingRequest(true);
      toast.success('Storage request submitted successfully! Please wait for library approval.');
    } catch (error) {
      console.error('Error requesting storage:', error.response || error);
      if (error.response?.status === 401) {
        toast.error('Session expired. Please login again.');
        logout();
      } else if (error.response?.status === 400) {
        toast.error(error.response.data.message);
      } else {
        toast.error(error.response?.data?.message || 'Failed to request storage');
      }
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  // Loading state
  if (!user) {
    return (
      <div className="dashboard-container">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Student Dashboard</h1>
          <div className="user-info">
            <span>Welcome, {user.email}</span>
            <button onClick={handleLogout} className="logout-btn">Logout</button>
          </div>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-content">
          {/* No Storage State */}
          {!storage && !pendingRequest && (
            <div className="no-storage">
              <div className="storage-card">
                <h2>Request Storage</h2>
                <p>You don't have any active storage. Request one now!</p>
                <div className="storage-info">
                  <div className="info-item">
                    <strong>Available:</strong> 500 storage boxes
                  </div>
                  
                  <div className="info-item">
                    <strong>Process:</strong> Submit request → Get approval → Receive access code
                  </div>
                </div>
                <button 
                  onClick={requestStorage} 
                  disabled={loading}
                  className="request-btn"
                >
                  {loading ? 'Requesting...' : 'Look for Empty Storage'}
                </button>
              </div>
            </div>
          )}

          {/* Pending Request State */}
          {pendingRequest && !storage && (
            <div className="pending-request">
              <div className="storage-card pending">
                <h2>Request Pending</h2>
                <p>Your storage request is being processed by the library staff.</p>
                <div className="status-indicator">
                  <div className="spinner"></div>
                  <span>Waiting for approval...</span>
                </div>
                <div className="pending-info">
                  <p><strong>What happens next:</strong></p>
                  <ul>
                    <li>Library staff will review your request</li>
                    <li>An available storage box will be assigned</li>
                    <li>You'll receive a 6-digit access code</li>
                    <li>Use the code to access your storage</li>
                  </ul>
                </div>
                <button 
                  onClick={fetchStorageData} 
                  className="refresh-btn"
                  disabled={loading}
                >
                  {loading ? 'Refreshing...' : 'Refresh Status'}
                </button>
              </div>
            </div>
          )}

          {/* Active Storage State */}
          {storage && (
            <div className="active-storage">
              <div className="storage-card active">
                <h2>Active Storage</h2>
                <div className="storage-details">
                  <div className="detail-item">
                    <label>Storage Box Number:</label>
                    <span className="box-number">#{storage.boxNumber}</span>
                  </div>
                  <div className="detail-item">
                    <label>Access Code:</label>
                    <span className="access-code">{storage.accessCode}</span>
                  </div>
                  <div className="detail-item">
                    <label>Assigned At:</label>
                    <span>{formatDate(storage.occupiedAt)}</span>
                  </div>
                 
                  <div className="detail-item">
                    <label>Status:</label>
                    <span className="status-active">Active</span>
                  </div>
                </div>
                
                <div className="storage-instructions">
                  <h3>How to Use Your Storage</h3>
                  <div className="instructions-grid">
                    <div className="instruction-item">
                      <div className="instruction-number">1</div>
                      <div className="instruction-text">
                        <strong>Visit the Library</strong>
                        <p>Go to the library counter with your items</p>
                      </div>
                    </div>
                    <div className="instruction-item">
                      <div className="instruction-number">2</div>
                      <div className="instruction-text">
                        <strong>Provide Access Code</strong>
                        <p>Give your 6-digit code to the librarian</p>
                      </div>
                    </div>
                    <div className="instruction-item">
                      <div className="instruction-number">3</div>
                      <div className="instruction-text">
                        <strong>Store Your Items</strong>
                        <p>Librarian will help you access box #{storage.boxNumber}</p>
                      </div>
                    </div>
                    <div className="instruction-item">
                      <div className="instruction-number">4</div>
                      <div className="instruction-text">
                        <strong>Retrieve Items</strong>
                        <p>Use the same code to retrieve your items later</p>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="storage-note">
                  <div className="note-header">
                    <strong>⚠️ Important Notes:</strong>
                  </div>
                  <ul>
                    <li>Keep your access code <strong>{storage.accessCode}</strong> safe and secure</li>
                   
                    <li>Only the librarian can access your storage box</li>
                    <li>Make sure to retrieve your items before expiry</li>
                  </ul>
                </div>

                <div className="action-buttons">
                  <button 
                    onClick={fetchStorageData} 
                    className="refresh-btn"
                    disabled={loading}
                  >
                    {loading ? 'Refreshing...' : 'Refresh Status'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
