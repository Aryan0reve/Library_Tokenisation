import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import axios from 'axios';
import io from 'socket.io-client';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
  const [storageBoxes, setStorageBoxes] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [selectedBox, setSelectedBox] = useState(null);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [releaseForm, setReleaseForm] = useState({ boxNumber: '', accessCode: '' });
  const [loading, setLoading] = useState(false);
  const { logout } = useAuth();

  useEffect(() => {
    fetchStorageBoxes();
    fetchPendingRequests();
    
    const socket = io('http://localhost:5000');
    
    socket.on('new-request', (request) => {
      setPendingRequests(prev => [request, ...prev]);
      toast.info(`New storage request from ${request.studentEmail}`);
    });

    socket.on('storage-updated', (updatedStorage) => {
      setStorageBoxes(prev => 
        prev.map(box => 
          box.boxNumber === updatedStorage.boxNumber ? updatedStorage : box
        )
      );
    });

    return () => socket.disconnect();
  }, []);

  const fetchStorageBoxes = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/library/storage-boxes');
      setStorageBoxes(response.data);
    } catch (error) {
      toast.error('Failed to fetch storage boxes');
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await axios.get('http://localhost:5000/api/library/pending-requests');
      setPendingRequests(response.data);
    } catch (error) {
      toast.error('Failed to fetch pending requests');
    }
  };

  const assignStorage = async () => {
    if (!selectedBox || !selectedRequest) {
      toast.error('Please select both a storage box and a request');
      return;
    }

    setLoading(true);
    try {
      await axios.post('http://localhost:5000/api/library/assign-storage', {
        requestId: selectedRequest._id,
        boxNumber: selectedBox.boxNumber
      });

      setPendingRequests(prev => 
        prev.filter(req => req._id !== selectedRequest._id)
      );
      setSelectedBox(null);
      setSelectedRequest(null);
      toast.success(`Storage assigned successfully to ${selectedRequest.studentEmail}`);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to assign storage');
    } finally {
      setLoading(false);
    }
  };

  const releaseStorage = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await axios.post('http://localhost:5000/api/library/release-storage', releaseForm);
      setReleaseForm({ boxNumber: '', accessCode: '' });
      toast.success('Storage released successfully');
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to release storage');
    } finally {
      setLoading(false);
    }
  };

  const getBoxColor = (box) => {
    return box.isOccupied ? 'occupied' : 'available';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="library-dashboard">
      <header className="dashboard-header">
        <div className="header-content">
          <h1>Library Management System</h1>
          <button onClick={logout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="dashboard-content">
        {/* Storage Grid */}
        <div className="storage-section">
          <h2>Storage Boxes (1-500)</h2>
          <div className="legend">
            <span className="legend-item available">Available</span>
            <span className="legend-item occupied">Occupied</span>
          </div>
          <div className="storage-grid">
            {storageBoxes.map(box => (
              <div
                key={box.boxNumber}
                className={`storage-box ${getBoxColor(box)} ${selectedBox?.boxNumber === box.boxNumber ? 'selected' : ''}`}
                onClick={() => !box.isOccupied && setSelectedBox(box)}
                title={box.isOccupied ? `Occupied by ${box.occupiedBy?.email} since ${formatDate(box.occupiedAt)}` : 'Available'}
              >
                {box.boxNumber}
              </div>
            ))}
          </div>
        </div>

        <div className="management-section">
          {/* Pending Requests */}
          <div className="requests-panel">
            <h3>Pending Storage Requests</h3>
            {pendingRequests.length === 0 ? (
              <p className="no-requests">No pending requests</p>
            ) : (
              <div className="requests-list">
                {pendingRequests.map(request => (
                  <div
                    key={request._id}
                    className={`request-item ${selectedRequest?._id === request._id ? 'selected' : ''}`}
                    onClick={() => setSelectedRequest(request)}
                  >
                    <div className="request-info">
                      <strong>{request.studentEmail}</strong>
                      <span>{formatDate(request.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assignment Panel */}
          <div className="assignment-panel">
            <h3>Assign Storage</h3>
            <div className="selection-info">
              <p>Selected Request: {selectedRequest ? selectedRequest.studentEmail : 'None'}</p>
              <p>Selected Box: {selectedBox ? `#${selectedBox.boxNumber}` : 'None'}</p>
            </div>
            <button
              onClick={assignStorage}
              disabled={!selectedBox || !selectedRequest || loading}
              className="assign-btn"
            >
              {loading ? 'Assigning...' : 'Assign Storage'}
            </button>
          </div>

          {/* Release Storage Panel */}
          <div className="release-panel">
            <h3>Release Storage</h3>
            <form onSubmit={releaseStorage}>
              <div className="form-group">
                <label>Box Number:</label>
                <input
                  type="number"
                  min="1"
                  max="500"
                  value={releaseForm.boxNumber}
                  onChange={(e) => setReleaseForm({...releaseForm, boxNumber: e.target.value})}
                  required
                />
              </div>
              <div className="form-group">
                <label>Access Code:</label>
                <input
                  type="text"
                  maxLength="6"
                  value={releaseForm.accessCode}
                  onChange={(e) => setReleaseForm({...releaseForm, accessCode: e.target.value})}
                  required
                />
              </div>
              <button type="submit" disabled={loading} className="release-btn">
                {loading ? 'Releasing...' : 'Release Storage'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
