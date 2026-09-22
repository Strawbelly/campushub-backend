export interface IHealthStatus {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export const getHealthStatus = (): IHealthStatus => {
  return {
    status: 'ok',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
};
