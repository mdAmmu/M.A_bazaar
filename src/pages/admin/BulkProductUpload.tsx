import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { X, Upload } from 'lucide-react';

interface BulkProductUploadProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkProductUpload({ onClose, onSuccess }: BulkProductUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const products = XLSX.utils.sheet_to_json(sheet) as Array<Record<string, unknown>>;

      if (products.length === 0) {
        setError('Excel file is empty');
        setUploading(false);
        return;
      }

      // Validate and format products
      const formattedProducts = products
        .map((p: Record<string, unknown>, index: number) => {
          // Required fields: name, price, image_url, stock
          if (!p.name || !p.price || !p.image_url || p.stock === undefined) {
            throw new Error(
              `Row ${index + 2}: Missing required fields. Required: name, price, image_url, stock`
            );
          }

          return {
            name: String(p.name).trim(),
            description: String(p.description || '').trim(),
            price: parseFloat(String(p.price)),
            image_url: String(p.image_url).trim(),
            stock: parseInt(String(p.stock), 10),
            category: String(p.category || '').trim() || null,
          };
        })
        .filter((p) => {
          // Validate numeric fields
          if (isNaN(p.price) || p.price <= 0) return false;
          if (isNaN(p.stock) || p.stock < 0) return false;
          return true;
        });

      if (formattedProducts.length === 0) {
        setError('No valid products found in the file');
        setUploading(false);
        return;
      }

      // Insert products in batches of 100 (Supabase limit)
      const batchSize = 100;
      for (let i = 0; i < formattedProducts.length; i += batchSize) {
        const batch = formattedProducts.slice(i, i + batchSize);
        const { error: insertError } = await supabase
          .from('products')
          .insert(batch);

        if (insertError) {
          throw new Error(`Failed to insert batch: ${insertError.message}`);
        }
      }

      alert(`Successfully uploaded ${formattedProducts.length} product(s)!`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Bulk upload error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to upload products. Please check the file format.';
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Bulk Product Upload</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition"
            disabled={uploading}
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>

        <div className="mb-6">
          <p className="text-sm text-gray-600 mb-4">
            Upload an Excel file (.xlsx, .xls) with the following columns:
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <p className="text-xs font-mono text-gray-700">
              <strong>Required:</strong> name, price, image_url, stock
              <br />
              <strong>Optional:</strong> description, category
            </p>
          </div>

          <label className="block">
            <div className="mt-2 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-blue-400 transition cursor-pointer">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <span className="relative cursor-pointer rounded-md font-medium text-blue-600 focus-within:outline-none">
                    Upload Excel file
                  </span>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">XLSX, XLS up to 10MB</p>
              </div>
            </div>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
              disabled={uploading}
            />
          </label>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm mb-4">
            {error}
          </div>
        )}

        {uploading && (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <span className="ml-3 text-gray-600">Uploading products...</span>
          </div>
        )}

        <div className="flex space-x-4">
          <button
            onClick={onClose}
            disabled={uploading}
            className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-semibold hover:bg-gray-300 transition disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
