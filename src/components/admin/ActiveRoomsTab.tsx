import React, { useState, useEffect } from 'react';
import { db } from '../../firebase';
import { collection, query, onSnapshot, doc, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { Radio, Trash2, Users, AlertTriangle } from 'lucide-react';

export default function ActiveRoomsTab() {
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, 'rooms'));
    const unsub = onSnapshot(q, (snapshot) => {
      setRooms(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsub();
  }, []);

  const handleCloseRoom = async (roomId: string) => {
    if (!confirm('هل أنت متأكد من إغلاق هذه الغرفة؟')) return;
    try {
      await deleteDoc(doc(db, 'rooms', roomId));
    } catch (error: any) {
      alert('خطأ في إغلاق الغرفة: ' + error.message);
    }
  };

  const handleDeleteAllRooms = async () => {
    if (!confirm('تحذير خطير: هل أنت متأكد من إغلاق وحذف جميع الغرف النشطة حالياً؟ سيتم طرد جميع المستخدمين منها.')) return;
    
    setLoading(true);
    try {
      const roomsRef = collection(db, 'rooms');
      const querySnapshot = await getDocs(roomsRef);
      
      const batch = writeBatch(db);
      let count = 0;
      
      querySnapshot.forEach((roomDoc) => {
        batch.delete(roomDoc.ref);
        count++;
      });
      
      if (count > 0) {
        await batch.commit();
        alert(`تم إغلاق وحذف ${count} غرفة بنجاح.`);
      } else {
        alert('لا توجد غرف نشطة حالياً لحذفها.');
      }
    } catch (error: any) {
      alert('خطأ أثناء حذف الغرف: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Radio className="text-purple-600" size={20} />
            الغرف المتصلة (النشطة)
          </h2>
          <button
            onClick={handleDeleteAllRooms}
            disabled={loading || rooms.length === 0}
            className={`px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 transition ${
              rooms.length === 0 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-200'
            }`}
          >
            <AlertTriangle size={16} />
            حذف وإغلاق جميع الغرف
          </button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {rooms.map((room) => (
            <div key={room.id} className="bg-gray-50 border border-gray-200 rounded-xl p-4 relative">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h3 className="font-bold text-gray-800 truncate pr-8">{room.title || 'غرفة بدون اسم'}</h3>
                  <p className="text-xs text-gray-500 mt-1">ID: {room.id}</p>
                </div>
                <button
                  onClick={() => handleCloseRoom(room.id)}
                  className="absolute top-4 left-4 p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"
                  title="إغلاق الغرفة"
                >
                  <Trash2 size={18} />
                </button>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-gray-600">
                <div className="flex items-center gap-1">
                  <Users size={16} />
                  <span>{room.audienceCount || 0}</span>
                </div>
                {room.hostId && (
                  <div className="text-xs truncate">
                    المضيف: {room.hostId}
                  </div>
                )}
              </div>
            </div>
          ))}
          
          {rooms.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500">
              لا توجد غرف نشطة حالياً
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
