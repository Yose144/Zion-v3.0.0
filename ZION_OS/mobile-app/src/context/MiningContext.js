import React, {createContext, useState, useContext, useEffect} from 'react';
import MiningService from '../services/MiningService';

const MiningContext = createContext();

export const useMining = () => {
  const context = useContext(MiningContext);
  if (!context) {
    throw new Error('useMining must be used within MiningProvider');
  }
  return context;
};

export const MiningProvider = ({children}) => {
  const [miningStats, setMiningStats] = useState(MiningService.getStats());
  const [updateInterval, setUpdateInterval] = useState(null);

  useEffect(() => {
    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
      MiningService.stopMining();
    };
  }, []);

  const startMining = async (walletAddress) => {
    try {
      await MiningService.startMining(walletAddress);
      
      // Start stats update interval
      const interval = setInterval(() => {
        setMiningStats(MiningService.getStats());
      }, 1000);
      setUpdateInterval(interval);
      
      setMiningStats(MiningService.getStats());
    } catch (error) {
      throw error;
    }
  };

  const stopMining = () => {
    MiningService.stopMining();
    
    if (updateInterval) {
      clearInterval(updateInterval);
      setUpdateInterval(null);
    }
    
    setMiningStats(MiningService.getStats());
  };

  const checkConditions = async () => {
    return await MiningService.canStartMining();
  };

  const value = {
    miningStats,
    startMining,
    stopMining,
    checkConditions,
  };

  return (
    <MiningContext.Provider value={value}>
      {children}
    </MiningContext.Provider>
  );
};
