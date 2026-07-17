import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

export const listRecordings = () => api.get('/recordings').then((r) => r.data);
export const getRecording = (id) => api.get(`/recordings/${id}`).then((r) => r.data);
export const uploadRecording = (file, onProgress) => {
  const form = new FormData();
  form.append('audio', file);
  return api
    .post('/recordings', form, {
      onUploadProgress: (e) => onProgress?.(Math.round((e.loaded / e.total) * 100)),
    })
    .then((r) => r.data);
};
export const deleteRecording = (id) => api.delete(`/recordings/${id}`).then((r) => r.data);
export const renameRecording = (id, title) => api.patch(`/recordings/${id}`, { title }).then((r) => r.data);

export default api;
