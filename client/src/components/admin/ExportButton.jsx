import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '../ui/Button';
import adminService from '../../services/adminService';

const ExportButton = ({ type = 'csv', params = {}, label, className = '' }) => {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const response = await adminService.exportData({ format: type, ...params });
      if (response?.data) {
        const blob = type === 'csv'
          ? new Blob([response.data], { type: 'text/csv' })
          : new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `looplane-export-${new Date().toISOString().slice(0, 10)}.${type}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // silent
    } finally {
      setExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={exporting}
      className={className}
    >
      {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      {label || `Export ${type.toUpperCase()}`}
    </Button>
  );
};

export default ExportButton;
