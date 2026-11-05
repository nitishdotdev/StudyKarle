import axiosClient from './axiosClient';

export function fetchProfile() {
  return axiosClient.get('/users/me').then(function (res) {
    return res.data.data;
  });
}

export function updateProfile(payload) {
  return axiosClient.patch('/users/me', payload).then(function (res) {
    return res.data.data;
  });
}

export function changePassword(payload) {
  return axiosClient.patch('/users/me/password', payload).then(function (res) {
    return res.data.data;
  });
}

export function fetchContinueStudying() {
  return axiosClient.get('/users/me/continue-studying').then(function (res) {
    return res.data.data;
  });
}
