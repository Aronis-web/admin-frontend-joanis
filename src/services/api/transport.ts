import { apiClient } from './client';
import {
  Driver,
  DriversResponse,
  CreateDriverRequest,
  UpdateDriverRequest,
  QueryDriversParams,
  Vehicle,
  VehiclesResponse,
  CreateVehicleRequest,
  UpdateVehicleRequest,
  QueryVehiclesParams,
  Transporter,
  TransportersResponse,
  CreateTransporterRequest,
  UpdateTransporterRequest,
  QueryTransportersParams,
} from '@/types/transport';

/**
 * Transport API Service
 * Handles all transport-related API calls (drivers, vehicles, transporters)
 */
class TransportService {
  private readonly basePath = '/transport';

  // ==================== DRIVERS ====================

  /**
   * Get all drivers with optional filters
   */
  async getDrivers(params?: QueryDriversParams): Promise<DriversResponse> {
    const response = await apiClient.get<Driver[] | DriversResponse>(`${this.basePath}/drivers`, {
      params,
    });

    // Handle both array and paginated response formats
    if (Array.isArray(response)) {
      return {
        data: response,
        meta: {
          total: response.length,
          page: 1,
          limit: response.length,
          totalPages: 1,
        },
      };
    }

    return response;
  }

  /**
   * Get a single driver by ID
   */
  async getDriver(id: string): Promise<Driver> {
    return apiClient.get<Driver>(`${this.basePath}/drivers/${id}`);
  }

  /**
   * Get driver by document number
   */
  async getDriverByDocument(numeroDocumento: string): Promise<Driver> {
    return apiClient.get<Driver>(`${this.basePath}/drivers/document/${numeroDocumento}`);
  }

  /**
   * Get driver by license number
   */
  async getDriverByLicense(numeroLicencia: string): Promise<Driver> {
    return apiClient.get<Driver>(`${this.basePath}/drivers/license/${numeroLicencia}`);
  }

  /**
   * Create a new driver
   */
  async createDriver(data: CreateDriverRequest): Promise<Driver> {
    return apiClient.post<Driver>(`${this.basePath}/drivers`, data);
  }

  /**
   * Update a driver
   */
  async updateDriver(id: string, data: UpdateDriverRequest): Promise<Driver> {
    return apiClient.patch<Driver>(`${this.basePath}/drivers/${id}`, data);
  }

  /**
   * Delete a driver (soft delete)
   */
  async deleteDriver(id: string): Promise<void> {
    return apiClient.delete(`${this.basePath}/drivers/${id}`);
  }

  /**
   * Restore a deleted driver
   */
  async restoreDriver(id: string): Promise<Driver> {
    return apiClient.post<Driver>(`${this.basePath}/drivers/${id}/restore`);
  }

  // ==================== VEHICLES ====================

  /**
   * Get all vehicles with optional filters
   */
  async getVehicles(params?: QueryVehiclesParams): Promise<VehiclesResponse> {
    const response = await apiClient.get<Vehicle[] | VehiclesResponse>(
      `${this.basePath}/vehicles`,
      { params }
    );

    // Handle both array and paginated response formats
    if (Array.isArray(response)) {
      return {
        data: response,
        meta: {
          total: response.length,
          page: 1,
          limit: response.length,
          totalPages: 1,
        },
      };
    }

    return response;
  }

  /**
   * Get a single vehicle by ID
   */
  async getVehicle(id: string): Promise<Vehicle> {
    return apiClient.get<Vehicle>(`${this.basePath}/vehicles/${id}`);
  }

  /**
   * Get vehicle by plate number
   */
  async getVehicleByPlate(numeroPlaca: string): Promise<Vehicle> {
    return apiClient.get<Vehicle>(`${this.basePath}/vehicles/plate/${numeroPlaca}`);
  }

  /**
   * Create a new vehicle
   */
  async createVehicle(data: CreateVehicleRequest): Promise<Vehicle> {
    return apiClient.post<Vehicle>(`${this.basePath}/vehicles`, data);
  }

  /**
   * Update a vehicle
   */
  async updateVehicle(id: string, data: UpdateVehicleRequest): Promise<Vehicle> {
    return apiClient.patch<Vehicle>(`${this.basePath}/vehicles/${id}`, data);
  }

  /**
   * Delete a vehicle (soft delete)
   */
  async deleteVehicle(id: string): Promise<void> {
    return apiClient.delete(`${this.basePath}/vehicles/${id}`);
  }

  /**
   * Restore a deleted vehicle
   */
  async restoreVehicle(id: string): Promise<Vehicle> {
    return apiClient.post<Vehicle>(`${this.basePath}/vehicles/${id}/restore`);
  }

  // ==================== TRANSPORTERS ====================

  /**
   * Get all transporters with optional filters
   */
  async getTransporters(params?: QueryTransportersParams): Promise<TransportersResponse> {
    const response = await apiClient.get<Transporter[] | TransportersResponse>(
      `${this.basePath}/transporters`,
      { params }
    );

    // Handle both array and paginated response formats
    if (Array.isArray(response)) {
      return {
        data: response,
        meta: {
          total: response.length,
          page: 1,
          limit: response.length,
          totalPages: 1,
        },
      };
    }

    return response;
  }

  /**
   * Get a single transporter by ID
   */
  async getTransporter(id: string): Promise<Transporter> {
    return apiClient.get<Transporter>(`${this.basePath}/transporters/${id}`);
  }

  /**
   * Get transporter by RUC
   */
  async getTransporterByRuc(numeroRuc: string): Promise<Transporter> {
    return apiClient.get<Transporter>(`${this.basePath}/transporters/ruc/${numeroRuc}`);
  }

  /**
   * Create a new transporter
   */
  async createTransporter(data: CreateTransporterRequest): Promise<Transporter> {
    return apiClient.post<Transporter>(`${this.basePath}/transporters`, data);
  }

  /**
   * Update a transporter
   */
  async updateTransporter(id: string, data: UpdateTransporterRequest): Promise<Transporter> {
    return apiClient.patch<Transporter>(`${this.basePath}/transporters/${id}`, data);
  }

  /**
   * Delete a transporter (soft delete)
   */
  async deleteTransporter(id: string): Promise<void> {
    return apiClient.delete(`${this.basePath}/transporters/${id}`);
  }

  /**
   * Restore a deleted transporter
   */
  async restoreTransporter(id: string): Promise<Transporter> {
    return apiClient.post<Transporter>(`${this.basePath}/transporters/${id}/restore`);
  }
}

export const transportService = new TransportService();
