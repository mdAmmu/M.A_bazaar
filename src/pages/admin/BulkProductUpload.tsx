import { useState } from 'react';
import * as XLSX from 'xlsx';
import { supabase } from '../../lib/supabase';
import { X, Upload } from 'lucide-react';

interface BulkProductUploadProps {
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkProductUpload({
  onClose,
  onSuccess,
}: BulkProductUploadProps) {
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
  
      const rows = XLSX.utils.sheet_to_json(sheet, {
        defval: '', // prevents undefined values
      }) as Array<Record<string, unknown>>;
  
      if (rows.length === 0) {
        throw new Error('Excel file is empty');
      }
  
      const formattedProducts = rows.flatMap((raw, index) => {
        // Normalize column headers
        const normalized = Object.fromEntries(
          Object.entries(raw).map(([k, v]) => [k.toLowerCase().trim(), v])
        );
  
        const name = normalized.name;
        const price = normalized.price;
        const mrp = normalized.mrp;
        const stock = normalized.stock ?? normalized.stocks ?? normalized['stock_'];
        const category = normalized.category;
        const image_url = normalized.image_url;
        const item_id_raw =
          normalized.item_id ?? normalized['item id'] ?? normalized.itemid;
  
        // Skip completely empty rows
        if (!name && !price && !mrp && !stock) return [];
  
        // Skip incomplete rows
        if (
          String(name).trim() === '' ||
          String(price).trim() === '' ||
          String(mrp).trim() === '' ||
          String(stock).trim() === ''
        ) {
          console.warn(`Skipped row ${index + 2}: incomplete data`);
          return [];
        }
  
        const product: {
          name: string;
          price: number;
          mrp: number;
          stock: number;
          category: string | null;
          image_url: string | null;
          item_id?: number;
        } = {
          name: String(name).trim(),
          price: Number(price),
          mrp: Number(mrp),
          stock: Number(stock),
          category: category ? String(category).trim() : null,
          image_url: image_url ? String(image_url).trim() : null,
        };

        // Optional manual Item ID
        if (item_id_raw !== undefined && String(item_id_raw).trim() !== '') {
          const parsedItemId = Number(item_id_raw);
          if (!Number.isNaN(parsedItemId) && parsedItemId > 0) {
            product.item_id = parsedItemId;
          } else {
            console.warn(`Row ${index + 2}: invalid item_id, ignoring`);
          }
        }
  
        // Numeric validation
        if (
          isNaN(product.price) ||
          product.price < 0 ||
          isNaN(product.mrp) ||
          product.mrp < 0 ||
          isNaN(product.stock) ||
          product.stock < 0
        ) {
          console.warn(`Skipped row ${index + 2}: invalid numbers`);
          return [];
        }
  
        return [product];
      });
  
      if (formattedProducts.length === 0) {
        throw new Error('No valid products found in file');
      }
  
      // ---------------------------
      // REMOVE DUPLICATES BY NAME
      // Keep the last occurrence of each product name
      // ---------------------------
      const uniqueProducts = Object.values(
        formattedProducts.reduce((acc, product) => {
          acc[product.name] = product;
          return acc;
        }, {} as Record<string, typeof formattedProducts[0]>)
      );
  
      // ---------------------------
      // Insert in batches (Supabase safe)
      // ---------------------------
      const BATCH_SIZE = 100;
      for (let i = 0; i < uniqueProducts.length; i += BATCH_SIZE) {
        const batch = uniqueProducts.slice(i, i + BATCH_SIZE);
        const { error } = await supabase.from('products').upsert(batch, {
          onConflict: 'name',
        });
        if (error) throw new Error(error.message);
      }
  
      alert(`✅ Uploaded ${uniqueProducts.length} products successfully`);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Bulk upload error:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload products');
    } finally {
      setUploading(false);
    }
  };
  


  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold">
            Bulk Product Upload
          </h2>
          <button
            onClick={onClose}
            disabled={uploading}
            className="p-2 hover:bg-gray-100 rounded-full"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Excel columns:
          <br />
          <strong>Required:</strong> name, price, mrp, stock
          <br />
          <strong>Optional:</strong> item_id, category, image_url
        </p>

        <label className="block">
          <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400">
            <Upload className="mx-auto h-10 w-10 text-gray-400" />
            <p className="text-sm mt-2 text-gray-600">
              Upload Excel file
            </p>
          </div>
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>

        {error && (
          <div className="mt-4 bg-red-50 text-red-600 p-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {uploading && (
          <div className="flex items-center justify-center mt-4">
            <div className="animate-spin h-6 w-6 border-b-2 border-blue-600 rounded-full" />
            <span className="ml-3 text-gray-600">
              Uploading...
            </span>
          </div>
        )}

        <button
          onClick={onClose}
          disabled={uploading}
          className="mt-6 w-full bg-gray-200 py-3 rounded-lg font-semibold hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
