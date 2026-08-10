App({
  globalData: { myId: '' },
  onLaunch() {
    let id = wx.getStorageSync('tianxin_myid');
    if (!id) {
      id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      wx.setStorageSync('tianxin_myid', id);
    }
    this.globalData.myId = id;
  }
});
