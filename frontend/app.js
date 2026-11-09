/**
 * Main Application File
 * Handles all app logic and DOM manipulation
 */

console.log('app.js loaded successfully');

// Application State
const appState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  currentTab: 'Dashboard',
  vehicles: [],
  drivers: [],
  users: [],
  maintenanceRecords: [],
  tripRecords: [],
  expenseRecords: [],
};

// Initialize app on page load
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOMContentLoaded fired, initializing app');
  initializeApp();
});

/**
 * Initialize the application
 */
async function initializeApp() {
  console.log('initializeApp() called');
  // Check if user is already logged in
  const token = localStorage.getItem('access_token');
  
  // Ensure login-page is active by default
  document.getElementById('login-page').classList.add('active');
  
  if (token) {
    try {
      const response = await authService.getCurrentUser();
      appState.user = response.user;
      appState.isAuthenticated = true;
      showDashboard();
    } catch (error) {
      console.error('Failed to verify token:', error);
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      showLoginPage();
    }
  } else {
    showLoginPage();
  }

  // Load data from localStorage
  loadLocalStorageData();
}

/**
 * Load persisted data from localStorage
 */
function loadLocalStorageData() {
  try {
    const maintenance = localStorage.getItem('maintenanceRecords');
    const trips = localStorage.getItem('tripRecords');
    const expenses = localStorage.getItem('expenseRecords');

    if (maintenance) appState.maintenanceRecords = JSON.parse(maintenance);
    if (trips) appState.tripRecords = JSON.parse(trips);
    if (expenses) appState.expenseRecords = JSON.parse(expenses);
  } catch (error) {
    console.error('Error loading localStorage data:', error);
  }
}

/**
 * Switch to login page
 */
function showLoginPage() {
  document.getElementById('login-page').classList.add('active');
  document.getElementById('dashboard-page').classList.remove('active');
}

/**
 * Switch to dashboard page
 */
function showDashboard() {
  console.log('showDashboard() called');
  document.getElementById('login-page').classList.remove('active');
  document.getElementById('dashboard-page').classList.add('active');
  console.log('Dashboard classes updated');
  
  // Update user profile
  if (appState.user) {
    const initials = (appState.user.username || appState.user.phone || '').substring(0, 1).toUpperCase();
    document.getElementById('profile-avatar').textContent = initials;
    document.getElementById('user-name').textContent = appState.user.username || appState.user.phone || 'User';
    document.getElementById('user-role').textContent = `Role: ${appState.user.role || 'User'}`;
    
    // Hide restricted buttons from drivers
    const restrictedButtons = [
      'user-management-btn',
      'trip-dispatcher-btn',
      'add-vehicle-btn',
      'create-trip-btn',
      'add-maintenance-btn',
      'add-expense-btn'
    ];
    
    restrictedButtons.forEach(btnId => {
      const btn = document.getElementById(btnId);
      if (btn) {
        if (appState.user.role === 'driver') {
          btn.style.display = 'none';
        } else {
          btn.style.display = 'block';
        }
      }
    });
  }

  switchTab('Dashboard');
  loadDashboardData();
}

/**
 * Toggle authentication form between login and register
 */
function setAuthFieldsEnabled(containerId, enabled) {
  document.querySelectorAll(`#${containerId} input`).forEach((input) => {
    input.disabled = !enabled;
  });
}

function toggleAuthForm(event) {
  event.preventDefault();
  const isLogin = document.getElementById('login-fields').style.display !== 'none';
  const errorDiv = document.getElementById('error-message');
  const successDiv = document.getElementById('success-message');
  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';
  
  if (isLogin) {
    document.getElementById('login-fields').style.display = 'none';
    document.getElementById('register-fields').style.display = 'block';
    setAuthFieldsEnabled('login-fields', false);
    setAuthFieldsEnabled('register-fields', true);
    document.getElementById('login-title').textContent = 'Create your account';
    document.getElementById('login-subtitle').textContent = 'Register your fleet with Tracktable';
    document.getElementById('auth-btn').textContent = 'Register Now';
    document.getElementById('toggle-auth').innerHTML = 'Already have an account? <a href="#" onclick="toggleAuthForm(event)">Login here</a>';
  } else {
    document.getElementById('login-fields').style.display = 'block';
    document.getElementById('register-fields').style.display = 'none';
    setAuthFieldsEnabled('login-fields', true);
    setAuthFieldsEnabled('register-fields', false);
    document.getElementById('login-title').textContent = 'Welcome back';
    document.getElementById('login-subtitle').textContent = 'Login to your fleet dashboard';
    document.getElementById('auth-btn').textContent = 'Login Now';
    document.getElementById('toggle-auth').innerHTML = 'Don\'t have an account? <a href="#" onclick="toggleAuthForm(event)">Register here</a>';
  }
}

/**
 * Handle authentication form submission
 */
async function handleAuthSubmit(event) {
  event.preventDefault();
  console.log('handleAuthSubmit called');
  
  const isLogin = document.getElementById('login-fields').style.display !== 'none';
  const errorDiv = document.getElementById('error-message');
  const successDiv = document.getElementById('success-message');
  const submitBtn = document.getElementById('auth-btn');
  
  errorDiv.style.display = 'none';
  successDiv.style.display = 'none';
  submitBtn.disabled = true;
  
  try {
    if (isLogin) {
      const phone = document.getElementById('phone').value.trim();
      const password = document.getElementById('password').value;
      
      const response = await authService.login({ phone, password });
      startSession(response);
    } else {
      const userData = {
        name: document.getElementById('name').value.trim(),
        phone: document.getElementById('reg-phone').value.trim(),
        email: document.getElementById('email').value.trim(),
        license_number: document.getElementById('license_number').value.trim(),
        license_expiry: document.getElementById('license_expiry').value || null,
        password: document.getElementById('reg-password').value,
      };
      const confirmPassword = document.getElementById('confirmPassword').value;
      
      if (userData.password !== confirmPassword) {
        showError('Passwords do not match');
        return;
      }
      
      await authService.register(userData);
      const loginResponse = await authService.login({
        phone: userData.phone,
        password: userData.password,
      });
      startSession(loginResponse);
    }
  } catch (error) {
    console.error('Authentication error:', error);
    showError(error.message || 'Authentication failed');
  } finally {
    submitBtn.disabled = false;
  }
}

function startSession(response) {
  localStorage.setItem('access_token', response.access_token);
  localStorage.setItem('refresh_token', response.refresh_token);
  appState.user = response.user;
  appState.isAuthenticated = true;
  appState.vehicles = [];
  appState.drivers = [];
  appState.users = [];
  appState.tripRecords = [];
  appState.maintenanceRecords = [];
  showDashboard();
}

/**
 * Show error message
 */
function showError(message) {
  const errorDiv = document.getElementById('error-message');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

/**
 * Show success message
 */
function showSuccess(message) {
  const successDiv = document.getElementById('success-message');
  successDiv.textContent = message;
  successDiv.style.display = 'block';
  setTimeout(() => {
    successDiv.style.display = 'none';
  }, 5000);
}

/**
 * Load all dashboard data from backend
 */
async function loadDashboardData() {
  console.log(`[loadDashboardData] Starting to load dashboard data`);
  try {
    // Load vehicles
    console.log(`[loadDashboardData] Fetching vehicles...`);
    const vehiclesResponse = await vehicleService.getAll();
    console.log(`[loadDashboardData] Vehicles response:`, vehiclesResponse);
    appState.vehicles = vehiclesResponse.vehicles || vehiclesResponse.data || [];
    console.log(`[loadDashboardData] appState.vehicles set to:`, appState.vehicles);
    
    // Load drivers
    console.log(`[loadDashboardData] Fetching drivers...`);
    const driversResponse = await driverService.getAll();
    console.log(`[loadDashboardData] Drivers response:`, driversResponse);
    appState.drivers = driversResponse.drivers || driversResponse.data || [];
    console.log(`[loadDashboardData] appState.drivers set to:`, appState.drivers);
    
    // Load active trips
    console.log(`[loadDashboardData] Fetching active trips...`);
    const tripsResponse = await tripService.getAll('active');
    console.log(`[loadDashboardData] Trips response:`, tripsResponse);
    appState.tripRecords = tripsResponse.trips || [];
    console.log(`[loadDashboardData] appState.tripRecords set to:`, appState.tripRecords);
    
    // Load maintenance records
    console.log(`[loadDashboardData] Fetching maintenance records...`);
    const maintenanceResponse = await maintenanceService.getAll();
    console.log(`[loadDashboardData] Maintenance response:`, maintenanceResponse);
    appState.maintenanceRecords = maintenanceResponse.maintenance || [];
    console.log(`[loadDashboardData] appState.maintenanceRecords set to:`, appState.maintenanceRecords);
    
    // Check for expired maintenance
    console.log(`[loadDashboardData] Checking for expired maintenance...`);
    await maintenanceService.checkExpired();
    
    // Update dashboard stats
    updateDashboardStats();
    
    // Render tables
    console.log(`[loadDashboardData] Rendering tables...`);
    renderVehiclesTable();
    renderDriversTable();
    renderTripsTable();
    renderDashboardActiveTrips();
    renderMaintenanceTable();
    console.log(`[loadDashboardData] Dashboard data loaded successfully`);
  } catch (error) {
    console.error('Failed to load dashboard data:', error);
    console.error('Error details:', {
      message: error.message,
      status: error.status,
      data: error.data
    });
  }
}

/**
 * Update dashboard statistics
 */
function updateDashboardStats() {
  const totalVehicles = appState.vehicles.length;
  const activeVehicles = appState.vehicles.filter(v => v.status === 'active').length;
  const totalDrivers = appState.drivers.length;
  const activeTrips = appState.tripRecords.length;
  
  document.getElementById('stat-total-vehicles').textContent = totalVehicles;
  document.getElementById('stat-active-vehicles').textContent = activeVehicles;
  document.getElementById('stat-drivers').textContent = totalDrivers;
  document.getElementById('stat-active-trips').textContent = activeTrips;
}

/**
 * Switch between dashboard tabs
 */
function switchTab(tabName, event) {
  if (event) {
    event.preventDefault();
  }
  
  console.log(`[switchTab] Switching to tab: ${tabName}`);
  appState.currentTab = tabName;
  
  // Hide all tabs
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Deactivate all nav buttons
  document.querySelectorAll('.nav-button').forEach(btn => {
    btn.classList.remove('active');
  });
  
  // Show selected tab
  const tabElement = document.getElementById(`tab-${tabName}`);
  console.log(`[switchTab] Looking for element with id: tab-${tabName}, found:`, tabElement);
  if (tabElement) {
    tabElement.classList.add('active');
    console.log(`[switchTab] Added active class to tab`);
  } else {
    console.error(`[switchTab] ERROR: Tab element not found!`);
  }
  
  // Activate nav button
  const navBtn = document.querySelector(`[data-tab="${tabName}"]`);
  if (navBtn) {
    navBtn.classList.add('active');
    console.log(`[switchTab] Activated nav button`);
  }
  
  // Load tab-specific data
  if (tabName === 'User Management') {
    console.log(`[switchTab] Loading user management data`);
    loadUserManagementData();
  }
  
  if (tabName === 'Trip & Expense') {
    console.log(`[switchTab] Loading completed trips data`);
    renderCompletedTrips();
  }
}

/**
 * Render vehicles table
 */
function renderVehiclesTable() {
  console.log(`[renderVehiclesTable] Called. appState.vehicles:`, appState.vehicles);
  const tbody = document.getElementById('vehicles-tbody');
  const vehicles = appState.vehicles;
  
  if (vehicles.length === 0) {
    console.log(`[renderVehiclesTable] No vehicles found, showing empty row`);
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No vehicles found</td></tr>';
    return;
  }
  
  console.log(`[renderVehiclesTable] Rendering ${vehicles.length} vehicles`);
  tbody.innerHTML = vehicles.map(vehicle => `
    <tr>
      <td>${vehicle.vehicle_number}</td>
      <td>${vehicle.make || '—'}</td>
      <td>${vehicle.model || '—'}</td>
      <td>${vehicle.license_plate || '—'}</td>
      <td><span class="badge ${vehicle.status}">${vehicle.status}</span></td>
      <td>
        <button class="action-btn" onclick="editVehicle('${vehicle.vehicle_number}')">Edit</button>
        <button class="action-btn danger" onclick="deleteVehicle('${vehicle.vehicle_number}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

/**
 * Render drivers table
 */
function renderDriversTable() {
  const tbody = document.getElementById('drivers-tbody');
  const drivers = appState.drivers;
  
  if (drivers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No drivers found</td></tr>';
    return;
  }
  
  tbody.innerHTML = drivers.map(driver => `
    <tr>
      <td>${driver.name}</td>
      <td>${driver.phone || '—'}</td>
      <td>${driver.license_number}</td>
      <td>${driver.license_expiry || '—'}</td>
      <td><span class="badge ${driver.status}">${driver.status}</span></td>
      <td>
        ${appState.user.role !== 'driver' ? `<button class="action-btn" onclick="editDriver('${driver.phone}')">Edit</button>` : ''}
        ${appState.user.role !== 'driver' ? `<button class="action-btn danger" onclick="deleteDriver('${driver.phone}')">Delete</button>` : ''}
      </td>
    </tr>
  `).join('');
}

/**
 * Render maintenance table
 */
function renderMaintenanceTable() {
  const tbody = document.getElementById('maintenance-tbody');
  const records = appState.maintenanceRecords;
  
  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No maintenance records found</td></tr>';
    return;
  }
  
  tbody.innerHTML = records.map(record => `
    <tr>
      <td>${record.vehicle_number}</td>
      <td>${record.type}</td>
      <td>${record.description || '—'}</td>
      <td>${record.date}</td>
      <td>${record.duration_days} day(s)</td>
      <td>$${parseFloat(record.cost || 0).toFixed(2)}</td>
      <td><span class="badge ${record.status}">${record.status}</span></td>
      <td>
        ${record.status !== 'completed' ? `<button class="action-btn success" onclick="completeMaintenanceRecord(${record.id})">Complete</button>` : '—'}
      </td>
    </tr>
  `).join('');
}

/**
 * Render expense table
 */
function renderExpenseTable() {
  const tbody = document.getElementById('expense-tbody');
  const records = appState.expenseRecords;
  
  if (records.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No expenses found</td></tr>';
    return;
  }
  
  tbody.innerHTML = records.map(record => `
    <tr>
      <td>${record.vehicle_number}</td>
      <td>${record.category}</td>
      <td>$${parseFloat(record.amount || 0).toFixed(2)}</td>
      <td>${record.date}</td>
      <td>${record.notes || '—'}</td>
      <td>
        <button class="action-btn danger" onclick="deleteExpenseRecord(${record.id})">Delete</button>
      </td>
    </tr>
  `).join('');
}

/**
 * Load user management data
 */
async function loadUserManagementData() {
  try {
    const response = await userService.getAll();
    appState.users = response.users || [];
    renderUsersTable();
  } catch (error) {
    console.error('Failed to load users:', error);
  }
}

/**
 * Render users table
 */
function renderUsersTable() {
  const tbody = document.getElementById('users-tbody');
  const users = appState.users;
  
  if (users.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No users found</td></tr>';
    return;
  }
  
  tbody.innerHTML = users.map(user => `
    <tr>
      <td>${user.phone}</td>
      <td>${user.username || '—'}</td>
      <td>${user.email || '—'}</td>
      <td><span class="badge ${user.role}">${user.role}</span></td>
      <td>${new Date(user.created_at).toLocaleDateString()}</td>
      <td>
        ${user.role === 'driver' ? `<button class="action-btn" onclick="toggleUserRole('${user.phone}', '${user.role}')">Promote to Manager</button>` : `<button class="action-btn" onclick="toggleUserRole('${user.phone}', '${user.role}')">Demote to Driver</button>`}
        <button class="action-btn danger" onclick="deleteUser('${user.phone}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

/**
 * Filter vehicles
 */
function filterVehicles() {
  const searchTerm = document.getElementById('vehicle-search').value.toLowerCase();
  const statusFilter = document.getElementById('vehicle-status-filter').value;
  
  let filtered = appState.vehicles;
  
  if (searchTerm) {
    filtered = filtered.filter(v => 
      v.vehicle_number.toLowerCase().includes(searchTerm) ||
      (v.make && v.make.toLowerCase().includes(searchTerm)) ||
      (v.model && v.model.toLowerCase().includes(searchTerm))
    );
  }
  
  if (statusFilter) {
    filtered = filtered.filter(v => v.status === statusFilter);
  }
  
  const tbody = document.getElementById('vehicles-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No vehicles found</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map(vehicle => `
    <tr>
      <td>${vehicle.vehicle_number}</td>
      <td>${vehicle.make || '—'}</td>
      <td>${vehicle.model || '—'}</td>
      <td>${vehicle.license_plate || '—'}</td>
      <td><span class="badge ${vehicle.status}">${vehicle.status}</span></td>
      <td>
        <button class="action-btn" onclick="editVehicle('${vehicle.vehicle_number}')">Edit</button>
        <button class="action-btn danger" onclick="deleteVehicle('${vehicle.vehicle_number}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

/**
 * Filter drivers
 */
function filterDrivers() {
  const searchTerm = document.getElementById('driver-search').value.toLowerCase();
  const statusFilter = document.getElementById('driver-status-filter').value;
  
  let filtered = appState.drivers;
  
  if (searchTerm) {
    filtered = filtered.filter(d => 
      d.name.toLowerCase().includes(searchTerm) ||
      (d.phone && d.phone.includes(searchTerm)) ||
      (d.license_number && d.license_number.toLowerCase().includes(searchTerm))
    );
  }
  
  if (statusFilter) {
    filtered = filtered.filter(d => d.status === statusFilter);
  }
  
  const tbody = document.getElementById('drivers-tbody');
  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No drivers found</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtered.map(driver => `
    <tr>
      <td>${driver.name}</td>
      <td>${driver.phone || '—'}</td>
      <td>${driver.license_number}</td>
      <td>${driver.license_expiry || '—'}</td>
      <td><span class="badge ${driver.status}">${driver.status}</span></td>
      <td>
        <button class="action-btn" onclick="editDriver('${driver.phone}')">Edit</button>
        <button class="action-btn danger" onclick="deleteDriver('${driver.phone}')">Delete</button>
      </td>
    </tr>
  `).join('');
}

/**
 * Modal Management
 */
function openAddVehicleModal() {
  clearVehicleForm();
  document.getElementById('vehicle-modal-title').textContent = 'Add Vehicle';
  document.getElementById('vehicle-submit-btn').textContent = 'Add Vehicle';
  document.getElementById('vehicle-modal').classList.add('active');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.remove('active');
  const errorDiv = document.getElementById(`${modalId.replace('-modal', '')}-modal-error`);
  if (errorDiv) errorDiv.style.display = 'none';
}

function clearVehicleForm() {
  document.getElementById('vehicle-number').value = '';
  document.getElementById('vehicle-make').value = '';
  document.getElementById('vehicle-model').value = '';
  document.getElementById('vehicle-license-plate').value = '';
  document.getElementById('vehicle-capacity').value = '';
  document.getElementById('vehicle-mileage').value = '';
  document.getElementById('vehicle-status').value = 'active';
}

/**
 * Handle vehicle form submission
 */
async function handleVehicleSubmit(event) {
  event.preventDefault();
  
  const vehicleNumber = document.getElementById('vehicle-number').value;
  const isReadonly = document.getElementById('vehicle-number').hasAttribute('readonly');
  
  const vehicleData = {
    vehicle_number: vehicleNumber,
    make: document.getElementById('vehicle-make').value || null,
    model: document.getElementById('vehicle-model').value || null,
    license_plate: document.getElementById('vehicle-license-plate').value || null,
    holding_capacity: document.getElementById('vehicle-capacity').value ? parseInt(document.getElementById('vehicle-capacity').value) : null,
    mileage: document.getElementById('vehicle-mileage').value ? parseInt(document.getElementById('vehicle-mileage').value) : 0,
    status: document.getElementById('vehicle-status').value,
  };
  
  try {
    if (isReadonly) {
      // Editing existing vehicle
      await vehicleService.update(vehicleNumber, vehicleData);
      showSuccess('Vehicle updated successfully');
    } else {
      // Creating new vehicle
      await vehicleService.create(vehicleData);
      showSuccess('Vehicle created successfully');
    }
    closeModal('vehicle-modal');
    await loadDashboardData();
  } catch (error) {
    showModalError('vehicle-modal-error', error.message);
  }
}

function showModalError(elementId, message) {
  const errorDiv = document.getElementById(elementId);
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function deleteVehicle(vehicleNumber) {
  if (!confirm('Are you sure you want to delete this vehicle?')) return;
  
  vehicleService.delete(vehicleNumber)
    .then(() => {
      appState.vehicles = appState.vehicles.filter(v => v.vehicle_number !== vehicleNumber);
      renderVehiclesTable();
      showSuccess('Vehicle deleted successfully');
    })
    .catch(error => showError(error.message));
}

function editVehicle(vehicleNumber) {
  const vehicle = appState.vehicles.find(v => v.vehicle_number === vehicleNumber);
  if (!vehicle) return;
  
  document.getElementById('vehicle-number').value = vehicle.vehicle_number;
  document.getElementById('vehicle-make').value = vehicle.make || '';
  document.getElementById('vehicle-model').value = vehicle.model || '';
  document.getElementById('vehicle-license-plate').value = vehicle.license_plate || '';
  document.getElementById('vehicle-capacity').value = vehicle.holding_capacity || '';
  document.getElementById('vehicle-mileage').value = vehicle.mileage || 0;
  document.getElementById('vehicle-status').value = vehicle.status;
  document.getElementById('vehicle-number').setAttribute('readonly', 'readonly');
  document.getElementById('vehicle-modal-title').textContent = 'Edit Vehicle';
  document.getElementById('vehicle-submit-btn').textContent = 'Update Vehicle';
  document.getElementById('vehicle-modal').classList.add('active');
}

/**
 * Add Driver Functionality
 */
function openAddDriverModal() {
  clearDriverForm();
  document.getElementById('driver-modal-title').textContent = 'Add Driver';
  document.getElementById('driver-submit-btn').textContent = 'Add Driver';
  document.getElementById('driver-phone').removeAttribute('readonly');
  document.getElementById('driver-modal').classList.add('active');
}

function clearDriverForm() {
  document.getElementById('driver-name').value = '';
  document.getElementById('driver-phone').value = '';
  document.getElementById('driver-email').value = '';
  document.getElementById('driver-license-number').value = '';
  document.getElementById('driver-license-expiry').value = '';
  document.getElementById('driver-status').value = 'available';
}

async function handleDriverSubmit(event) {
  event.preventDefault();
  
  const driverPhone = document.getElementById('driver-phone').value;
  const isReadonly = document.getElementById('driver-phone').hasAttribute('readonly');
  
  const driverData = {
    name: document.getElementById('driver-name').value,
    phone: driverPhone,
    email: document.getElementById('driver-email').value || null,
    license_number: document.getElementById('driver-license-number').value,
    license_expiry: document.getElementById('driver-license-expiry').value || null,
    status: document.getElementById('driver-status').value,
  };
  
  try {
    if (isReadonly) {
      // Editing existing driver
      await driverService.update(driverPhone, driverData);
      showSuccess('Driver updated successfully');
    } else {
      // Creating new driver
      await driverService.create(driverData);
      showSuccess('Driver created successfully');
    }
    closeModal('driver-modal');
    await loadDashboardData();
  } catch (error) {
    showModalError('driver-modal-error', error.message);
  }
}

function deleteDriver(phone) {
  if (!confirm('Are you sure you want to delete this driver?')) return;
  
  driverService.delete(phone)
    .then(() => {
      appState.drivers = appState.drivers.filter(d => d.phone !== phone);
      renderDriversTable();
      showSuccess('Driver deleted successfully');
    })
    .catch(error => showError(error.message));
}

function editDriver(phone) {
  const driver = appState.drivers.find(d => d.phone === phone);
  if (!driver) return;
  
  document.getElementById('driver-name').value = driver.name;
  document.getElementById('driver-phone').value = driver.phone;
  document.getElementById('driver-email').value = driver.email || '';
  document.getElementById('driver-license-number').value = driver.license_number;
  document.getElementById('driver-license-expiry').value = driver.license_expiry || '';
  document.getElementById('driver-status').value = driver.status;
  document.getElementById('driver-phone').setAttribute('readonly', 'readonly');
  document.getElementById('driver-modal-title').textContent = 'Edit Driver';
  document.getElementById('driver-submit-btn').textContent = 'Update Driver';
  document.getElementById('driver-modal').classList.add('active');
}

/**
 * Trip Management
 */
function openAddTripModal() {
  // Reset form fields
  document.getElementById('trip-origin').value = '';
  document.getElementById('trip-destination').value = '';
  document.getElementById('trip-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('trip-distance').value = '';
  document.getElementById('trip-fuel-type').value = 'petrol';
  
  // Populate vehicle dropdown
  const vehicleSelect = document.getElementById('trip-vehicle');
  vehicleSelect.innerHTML = '<option value="">Select a vehicle</option>';
  appState.vehicles.forEach(vehicle => {
    const option = document.createElement('option');
    option.value = vehicle.vehicle_number;
    option.textContent = `${vehicle.vehicle_number} - ${vehicle.make} ${vehicle.model}`;
    vehicleSelect.appendChild(option);
  });
  
  // Populate driver dropdown
  const driverSelect = document.getElementById('trip-driver');
  driverSelect.innerHTML = '<option value="">Select a driver</option>';
  appState.drivers.forEach(driver => {
    const option = document.createElement('option');
    option.value = driver.phone;
    option.textContent = `${driver.name} (${driver.phone})`;
    driverSelect.appendChild(option);
  });
  
  document.getElementById('trip-modal').classList.add('active');
}

async function handleTripSubmit(event) {
  event.preventDefault();
  
  const trip = {
    vehicle_number: document.getElementById('trip-vehicle').value,
    driver_phone: document.getElementById('trip-driver').value,
    origin: document.getElementById('trip-origin').value,
    destination: document.getElementById('trip-destination').value,
    date: document.getElementById('trip-date').value,
    distance: parseFloat(document.getElementById('trip-distance').value) || 0,
    fuel_type: document.getElementById('trip-fuel-type').value,
  };
  
  try {
    const response = await tripService.create(trip);
    appState.tripRecords.push(response.trip);
    closeModal('trip-modal');
    renderTripsTable();
    updateDashboardStats();
    showSuccess('Trip created successfully');
  } catch (error) {
    console.error('Failed to create trip:', error);
    showError('Failed to create trip: ' + (error.message || 'Unknown error'));
  }
}

function renderTripsTable() {
  const tbody = document.getElementById('trips-tbody');
  const trips = appState.tripRecords;
  
  if (trips.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No active trips found</td></tr>';
    return;
  }
  
  tbody.innerHTML = trips.map(trip => `
    <tr>
      <td>${trip.vehicle_number}</td>
      <td>${trip.driver_phone}</td>
      <td>${trip.origin}</td>
      <td>${trip.destination}</td>
      <td>${trip.date}</td>
      <td>${trip.distance} km</td>
      <td>
        <button class="action-btn success" onclick="completeTrip(${trip.id})">Trip Complete</button>
      </td>
    </tr>
  `).join('');
}

function renderDashboardActiveTrips() {
  const tbody = document.getElementById('active-trips-tbody');
  const trips = appState.tripRecords;
  
  if (trips.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-row">No active trips</td></tr>';
    return;
  }
  
  tbody.innerHTML = trips.map(trip => `
    <tr>
      <td>${trip.vehicle_number}</td>
      <td>${trip.driver_phone}</td>
      <td>${trip.origin}</td>
      <td>${trip.destination}</td>
      <td>${trip.date}</td>
      <td>${trip.distance} km</td>
      <td><span class="badge active">Active</span></td>
    </tr>
  `).join('');
}

/**
 * Render combined archival table (trips + expenses)
 */
async function renderArchivalTable() {
  try {
    const completedResponse = await tripService.getAll('completed');
    const completedTrips = completedResponse.trips || [];
    
    const tbody = document.getElementById('archival-tbody');
    
    // Combine trips and expenses
    const allRecords = [
      ...completedTrips.map(trip => ({
        type: 'Trip',
        vehicle: trip.vehicle_number,
        details: `${trip.origin} → ${trip.destination} (${trip.distance} km)`,
        amount: '—',
        date: trip.completed_at ? new Date(trip.completed_at).toLocaleDateString() : trip.date,
        id: trip.id,
        rowType: 'trip'
      })),
      ...appState.expenseRecords.map(expense => ({
        type: 'Expense',
        vehicle: expense.vehicle_number,
        details: `${expense.category}${expense.notes ? ' - ' + expense.notes : ''}`,
        amount: `$${parseFloat(expense.amount || 0).toFixed(2)}`,
        date: expense.date,
        id: expense.id,
        rowType: 'expense'
      }))
    ];
    
    // Sort by date (newest first)
    allRecords.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    if (allRecords.length === 0) {
      tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No records found</td></tr>';
      return;
    }
    
    tbody.innerHTML = allRecords.map(record => `
      <tr>
        <td><span class="badge ${record.rowType}">${record.type}</span></td>
        <td>${record.vehicle}</td>
        <td>${record.details}</td>
        <td>${record.amount}</td>
        <td>${record.date}</td>
        <td>
          ${record.rowType === 'expense' ? `<button class="action-btn danger" onclick="deleteExpenseRecord(${record.id})">Delete</button>` : ''}
        </td>
      </tr>
    `).join('');
  } catch (error) {
    console.error('Failed to load archival records:', error);
  }
}

async function renderCompletedTrips() {
  // Call the new combined archival table function
  await renderArchivalTable();
}

async function completeTrip(tripId) {
  if (!confirm('Are you sure you want to mark this trip as complete?')) return;
  
  try {
    await tripService.complete(tripId);
    // Remove from active trips
    appState.tripRecords = appState.tripRecords.filter(t => t.id !== tripId);
    renderTripsTable();
    updateDashboardStats();
    showSuccess('Trip completed successfully');
  } catch (error) {
    console.error('Failed to complete trip:', error);
    showError('Failed to complete trip: ' + (error.message || 'Unknown error'));
  }
}

function deleteTrip(tripId) {
  if (!confirm('Are you sure you want to delete this trip?')) return;
  
  appState.tripRecords = appState.tripRecords.filter(t => t.id !== tripId);
  localStorage.setItem('tripRecords', JSON.stringify(appState.tripRecords));
  renderTripsTable();
  showSuccess('Trip deleted successfully');
}

/**
 * Maintenance Management
 */
function openAddMaintenanceModal() {
  // Reset form fields
  document.getElementById('maintenance-type').value = '';
  document.getElementById('maintenance-description').value = '';
  document.getElementById('maintenance-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('maintenance-duration').value = '1';
  document.getElementById('maintenance-cost').value = '';
  
  // Populate vehicle dropdown
  const vehicleSelect = document.getElementById('maintenance-vehicle');
  vehicleSelect.innerHTML = '<option value="">Select a vehicle</option>';
  appState.vehicles.forEach(vehicle => {
    const option = document.createElement('option');
    option.value = vehicle.vehicle_number;
    option.textContent = `${vehicle.vehicle_number} - ${vehicle.make} ${vehicle.model} (${vehicle.status})`;
    vehicleSelect.appendChild(option);
  });
  
  document.getElementById('maintenance-modal').classList.add('active');
}

async function handleMaintenanceSubmit(event) {
  event.preventDefault();
  
  const record = {
    vehicle_number: document.getElementById('maintenance-vehicle').value,
    type: document.getElementById('maintenance-type').value,
    description: document.getElementById('maintenance-description').value,
    date: document.getElementById('maintenance-date').value,
    duration_days: parseInt(document.getElementById('maintenance-duration').value) || 1,
    cost: parseFloat(document.getElementById('maintenance-cost').value) || 0,
  };
  
  try {
    const response = await maintenanceService.create(record);
    appState.maintenanceRecords.push(response.maintenance);
    
    // Update the vehicle status in appState
    const vehicleIdx = appState.vehicles.findIndex(v => v.vehicle_number === record.vehicle_number);
    if (vehicleIdx !== -1) {
      appState.vehicles[vehicleIdx] = response.vehicle;
    }
    
    closeModal('maintenance-modal');
    renderMaintenanceTable();
    renderVehiclesTable();
    updateDashboardStats();
    showSuccess('Maintenance record created successfully');
  } catch (error) {
    console.error('Failed to create maintenance record:', error);
    showError('Failed to create maintenance record: ' + (error.message || 'Unknown error'));
  }
}

async function completeMaintenanceRecord(recordId) {
  if (!confirm('Are you sure you want to mark this maintenance as complete?')) return;
  
  try {
    const response = await maintenanceService.complete(recordId);
    
    // Update the maintenance record in appState
    const mainIdx = appState.maintenanceRecords.findIndex(r => r.id === recordId);
    if (mainIdx !== -1) {
      appState.maintenanceRecords[mainIdx] = response.maintenance;
    }
    
    // Update the vehicle in appState
    if (response.vehicle) {
      const vehicleIdx = appState.vehicles.findIndex(v => v.vehicle_number === response.vehicle.vehicle_number);
      if (vehicleIdx !== -1) {
        appState.vehicles[vehicleIdx] = response.vehicle;
      }
    }
    
    renderMaintenanceTable();
    renderVehiclesTable();
    updateDashboardStats();
    showSuccess('Maintenance completed successfully and vehicle restored to active');
  } catch (error) {
    console.error('Failed to complete maintenance:', error);
    showError('Failed to complete maintenance: ' + (error.message || 'Unknown error'));
  }
}

function deleteMaintenanceRecord(recordId) {
  if (!confirm('Are you sure you want to delete this maintenance record?')) return;
  
  appState.maintenanceRecords = appState.maintenanceRecords.filter(r => r.id !== recordId);
  localStorage.setItem('maintenanceRecords', JSON.stringify(appState.maintenanceRecords));
  renderMaintenanceTable();
  showSuccess('Maintenance record deleted successfully');
}

/**
 * Expense Management
 */
function openAddExpenseModal() {
  document.getElementById('expense-vehicle').value = '';
  document.getElementById('expense-category').value = '';
  document.getElementById('expense-amount').value = '';
  document.getElementById('expense-date').value = new Date().toISOString().split('T')[0];
  document.getElementById('expense-notes').value = '';
  document.getElementById('expense-modal').classList.add('active');
}

async function handleExpenseSubmit(event) {
  event.preventDefault();
  
  const record = {
    id: Date.now(),
    vehicle_number: document.getElementById('expense-vehicle').value,
    category: document.getElementById('expense-category').value,
    amount: parseFloat(document.getElementById('expense-amount').value) || 0,
    date: document.getElementById('expense-date').value,
    notes: document.getElementById('expense-notes').value,
  };
  
  appState.expenseRecords.push(record);
  localStorage.setItem('expenseRecords', JSON.stringify(appState.expenseRecords));
  
  closeModal('expense-modal');
  renderArchivalTable();
  showSuccess('Expense created successfully');
}

function deleteExpenseRecord(recordId) {
  if (!confirm('Are you sure you want to delete this expense?')) return;
  
  appState.expenseRecords = appState.expenseRecords.filter(r => r.id !== recordId);
  localStorage.setItem('expenseRecords', JSON.stringify(appState.expenseRecords));
  renderArchivalTable();
  showSuccess('Expense deleted successfully');
}

/**
 * User Management Functions
 */
async function toggleUserRole(userPhone, currentRole) {
  try {
    // If driver, promote to manager; if manager/admin/user, demote to driver
    const newRole = currentRole === 'driver' ? 'manager' : 'driver';
    await userService.updateRole(userPhone, newRole);
    await loadUserManagementData();
    showSuccess(`User role updated to ${newRole}`);
  } catch (error) {
    showError(error.message);
  }
}

async function deleteUser(phone) {
  if (!confirm('Are you sure you want to delete this user?')) return;
  
  try {
    await userService.delete(phone);
    await loadUserManagementData();
    showSuccess('User deleted successfully');
  } catch (error) {
    showError(error.message);
  }
}

/**
 * Profile Menu Toggle
 */
function toggleProfileMenu(event) {
  event.stopPropagation();
  const dropdown = document.getElementById('profile-dropdown');
  dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
}

// Close profile menu when clicking outside
document.addEventListener('click', () => {
  document.getElementById('profile-dropdown').style.display = 'none';
});

/**
 * Logout
 */
function handleLogout() {
  if (!confirm('Are you sure you want to logout?')) return;
  
  authService.logout();
  appState.isAuthenticated = false;
  appState.user = null;
  appState.vehicles = [];
  appState.drivers = [];
  appState.users = [];
  appState.tripRecords = [];
  appState.maintenanceRecords = [];
  showLoginPage();
}

/**
 * Export CSV
 */
function exportData(dataType) {
  let data, headers, filename;
  
  switch (dataType) {
    case 'vehicles':
      data = appState.vehicles;
      headers = ['vehicle_number', 'make', 'model', 'license_plate', 'status'];
      filename = 'vehicles';
      break;
    case 'drivers':
      data = appState.drivers;
      headers = ['name', 'phone', 'license_number', 'status'];
      filename = 'drivers';
      break;
    case 'maintenance':
      data = appState.maintenanceRecords;
      headers = ['vehicle_number', 'type', 'description', 'date', 'cost'];
      filename = 'maintenance';
      break;
    case 'users':
      data = appState.users;
      headers = ['phone', 'username', 'email', 'role', 'created_at'];
      filename = 'users';
      break;
    case 'expenses':
      data = appState.expenseRecords;
      headers = ['vehicle_number', 'category', 'amount', 'date', 'notes'];
      filename = 'expenses';
      break;
    default:
      return;
  }
  
  if (!data || data.length === 0) {
    alert('No data to export');
    return;
  }
  
  downloadCSV(data, headers, filename);
}

function downloadCSV(data, headers, filename) {
  const csvRows = [headers.join(',')];
  
  data.forEach(row => {
    const values = headers.map(header => {
      const val = row[header] ?? '';
      const str = String(val).replace(/"/g, '""');
      return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str}"` : str;
    });
    csvRows.push(values.join(','));
  });
  
  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
