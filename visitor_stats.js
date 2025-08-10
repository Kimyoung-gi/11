// 방문자 통계 관리
class VisitorStats {
    constructor() {
        this.visitorsRef = db.collection('visitors');
        this.onlineRef = db.collection('online_users');
        this.charts = {};
        this.currentVisitorId = null;
        this.visitStartTime = null;
        
        this.init();
    }
    
    init() {
        this.loadVisitorStats();
        this.setupRealTimeUpdates();
        this.startTrackingCurrentVisitor();
        
        // 관리자 대시보드에서만 차트 초기화
        if (window.location.pathname.includes('admin_dashboard.html')) {
            this.initializeCharts();
        }
    }
    
    // 방문자 통계 로드
    async loadVisitorStats() {
        try {
            // 관리자 대시보드에서만 통계 표시
            if (!window.location.pathname.includes('admin_dashboard.html')) {
                return;
            }
            
            // 총 방문자수
            const totalSnapshot = await this.visitorsRef.get();
            const totalVisitors = totalSnapshot.size;
            const totalVisitorsElement = document.getElementById('totalVisitors');
            if (totalVisitorsElement) {
                totalVisitorsElement.textContent = totalVisitors.toLocaleString();
            }
            
            // 오늘 방문자수
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todaySnapshot = await this.visitorsRef
                .where('visitTime', '>=', today)
                .get();
            const todayVisitors = todaySnapshot.size;
            const todayVisitorsElement = document.getElementById('todayVisitors');
            if (todayVisitorsElement) {
                todayVisitorsElement.textContent = todayVisitors.toLocaleString();
            }
            
            // 평균 체류시간 계산
            const avgStayTime = await this.calculateAverageStayTime();
            const avgStayTimeElement = document.getElementById('avgStayTime');
            if (avgStayTimeElement) {
                avgStayTimeElement.textContent = `${Math.round(avgStayTime)}분`;
            }
            
            // 최근 방문자 목록 업데이트
            this.updateRecentVisitorsList();
            
        } catch (error) {
            console.error('방문자 통계 로드 오류:', error);
        }
    }
    
    // 평균 체류시간 계산
    async calculateAverageStayTime() {
        try {
            const snapshot = await this.visitorsRef
                .where('stayTime', '>', 0)
                .get();
            
            if (snapshot.empty) return 0;
            
            let totalStayTime = 0;
            let count = 0;
            
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.stayTime) {
                    totalStayTime += data.stayTime;
                    count++;
                }
            });
            
            return count > 0 ? totalStayTime / count / 60000 : 0; // 분 단위로 변환
        } catch (error) {
            console.error('평균 체류시간 계산 오류:', error);
            return 0;
        }
    }
    
    // 실시간 업데이트 설정
    setupRealTimeUpdates() {
        // 관리자 대시보드에서만 실시간 업데이트 설정
        if (!window.location.pathname.includes('admin_dashboard.html')) {
            return;
        }
        
        // 방문자 데이터 실시간 업데이트
        this.visitorsRef
            .orderBy('visitTime', 'desc')
            .limit(10)
            .onSnapshot((snapshot) => {
                this.updateRecentVisitorsList();
                this.loadVisitorStats();
            });
    }
    
    // 최근 방문자 목록 업데이트
    async updateRecentVisitorsList() {
        try {
            // 관리자 대시보드에서만 실행
            if (!window.location.pathname.includes('admin_dashboard.html')) {
                return;
            }
            
            const snapshot = await this.visitorsRef
                .orderBy('visitTime', 'desc')
                .limit(10)
                .get();
            
            const tbody = document.getElementById('recentVisitorsTable');
            if (!tbody) return;
            
            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">방문자 데이터가 없습니다.</td></tr>';
                return;
            }
            
            let html = '';
            snapshot.forEach(doc => {
                const data = doc.data();
                const visitTime = data.visitTime.toDate();
                const stayTime = data.stayTime ? Math.round(data.stayTime / 60000) : 0;
                
                html += `
                    <tr>
                        <td>${visitTime.toLocaleString('ko-KR')}</td>
                        <td>${data.ipAddress || '알 수 없음'}</td>
                        <td>${stayTime}분</td>
                        <td>${data.page || '메인 페이지'}</td>
                        <td>${data.userAgent ? this.getBrowserInfo(data.userAgent) : '알 수 없음'}</td>
                    </tr>
                `;
            });
            
            tbody.innerHTML = html;
        } catch (error) {
            console.error('최근 방문자 목록 업데이트 오류:', error);
        }
    }
    
    // 브라우저 정보 추출
    getBrowserInfo(userAgent) {
        if (userAgent.includes('Chrome')) return 'Chrome';
        if (userAgent.includes('Firefox')) return 'Firefox';
        if (userAgent.includes('Safari')) return 'Safari';
        if (userAgent.includes('Edge')) return 'Edge';
        if (userAgent.includes('MSIE') || userAgent.includes('Trident')) return 'Internet Explorer';
        return '기타';
    }
    
    // 차트 초기화
    initializeCharts() {
        // 관리자 대시보드에서만 차트 초기화
        if (!window.location.pathname.includes('admin_dashboard.html')) {
            return;
        }
        
        this.createWeeklyChart();
        this.createStayTimeChart();
    }
    
    // 주간 방문자 차트 생성
    async createWeeklyChart() {
        try {
            const canvas = document.getElementById('weeklyChart');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            const weeklyData = await this.getWeeklyVisitorData();
            
            this.charts.weekly = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: weeklyData.labels,
                    datasets: [{
                        label: '방문자수',
                        data: weeklyData.data,
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        tension: 0.1
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
        } catch (error) {
            console.error('주간 차트 생성 오류:', error);
        }
    }
    
    // 체류시간 분포 차트 생성
    async createStayTimeChart() {
        try {
            const canvas = document.getElementById('stayTimeChart');
            if (!canvas) return;
            
            const ctx = canvas.getContext('2d');
            const stayTimeData = await this.getStayTimeDistribution();
            
            this.charts.stayTime = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: stayTimeData.labels,
                    datasets: [{
                        data: stayTimeData.data,
                        backgroundColor: [
                            '#FF6384',
                            '#36A2EB',
                            '#FFCE56',
                            '#4BC0C0',
                            '#9966FF'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'bottom'
                        }
                    }
                }
            });
        } catch (error) {
            console.error('체류시간 차트 생성 오류:', error);
        }
    }
    
    // 주간 방문자 데이터 가져오기
    async getWeeklyVisitorData() {
        const labels = [];
        const data = [];
        
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            
            const snapshot = await this.visitorsRef
                .where('visitTime', '>=', startOfDay)
                .where('visitTime', '<=', endOfDay)
                .get();
            
            labels.push(date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }));
            data.push(snapshot.size);
        }
        
        return { labels, data };
    }
    
    // 일자별 방문자 데이터 가져오기 (최대 3개월)
    async getDailyVisitorData(months = 3) {
        const data = [];
        
        for (let i = (months * 30) - 1; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            
            const snapshot = await this.visitorsRef
                .where('visitTime', '>=', startOfDay)
                .where('visitTime', '<=', endOfDay)
                .get();
            
            data.push({
                date: date.toISOString().split('T')[0], // YYYY-MM-DD 형식
                visitors: snapshot.size,
                formattedDate: date.toLocaleDateString('ko-KR', { 
                    year: 'numeric', 
                    month: '2-digit', 
                    day: '2-digit' 
                })
            });
        }
        
        return data;
    }
    
    // 체류시간 분포 데이터 가져오기
    async getStayTimeDistribution() {
        try {
            const snapshot = await this.visitorsRef
                .where('stayTime', '>', 0)
                .get();
            
            const distribution = {
                '5분 미만': 0,
                '5-15분': 0,
                '15-30분': 0,
                '30분-1시간': 0,
                '1시간 이상': 0
            };
            
            snapshot.forEach(doc => {
                const stayTime = doc.data().stayTime / 60000; // 분 단위
                
                if (stayTime < 5) distribution['5분 미만']++;
                else if (stayTime < 15) distribution['5-15분']++;
                else if (stayTime < 30) distribution['15-30분']++;
                else if (stayTime < 60) distribution['30분-1시간']++;
                else distribution['1시간 이상']++;
            });
            
            return {
                labels: Object.keys(distribution),
                data: Object.values(distribution)
            };
        } catch (error) {
            console.error('체류시간 분포 계산 오류:', error);
            return { labels: [], data: [] };
        }
    }
    
    // 현재 방문자 추적 시작
    startTrackingCurrentVisitor() {
        this.visitStartTime = Date.now();
        this.currentVisitorId = this.generateVisitorId();
        
        // 온라인 사용자로 등록
        this.onlineRef.doc(this.currentVisitorId).set({
            visitTime: new Date(),
            ipAddress: this.getClientIP(),
            userAgent: navigator.userAgent,
            page: window.location.pathname,
            lastActivity: new Date()
        });
        
        // 페이지 떠날 때 체류시간 기록
        window.addEventListener('beforeunload', () => {
            this.recordVisitorExit();
        });
        
        // 페이지 숨김/보임 이벤트로 체류시간 추적
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.recordVisitorExit();
            } else {
                this.visitStartTime = Date.now();
                // 활동 시간 업데이트
                this.onlineRef.doc(this.currentVisitorId).update({
                    lastActivity: new Date()
                });
            }
        });
        
        // 주기적으로 활동 시간 업데이트
        setInterval(() => {
            if (!document.hidden && this.currentVisitorId) {
                this.onlineRef.doc(this.currentVisitorId).update({
                    lastActivity: new Date()
                });
            }
        }, 30000); // 30초마다 업데이트
    }
    
    // 방문자 ID 생성
    generateVisitorId() {
        return 'visitor_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    // 클라이언트 IP 주소 가져오기 (간단한 방법)
    getClientIP() {
        // 실제 IP는 서버에서 가져와야 하지만, 여기서는 간단히 표시
        return '클라이언트 IP';
    }
    
    // 방문자 퇴장 기록
    async recordVisitorExit() {
        if (!this.currentVisitorId || !this.visitStartTime) return;
        
        const stayTime = Date.now() - this.visitStartTime;
        
        try {
            // 방문자 데이터 저장
            await this.visitorsRef.doc(this.currentVisitorId).set({
                visitTime: new Date(this.visitStartTime),
                exitTime: new Date(),
                stayTime: stayTime,
                ipAddress: this.getClientIP(),
                userAgent: navigator.userAgent,
                page: window.location.pathname
            });
            
            // 온라인 사용자에서 제거
            await this.onlineRef.doc(this.currentVisitorId).delete();
            
        } catch (error) {
            console.error('방문자 퇴장 기록 오류:', error);
        }
    }
    
    // 차트 새로고침
    async refreshCharts() {
        // 관리자 대시보드에서만 차트 새로고침
        if (!window.location.pathname.includes('admin_dashboard.html')) {
            return;
        }
        
        if (this.charts.weekly) {
            this.charts.weekly.destroy();
        }
        if (this.charts.stayTime) {
            this.charts.stayTime.destroy();
        }
        
        await this.initializeCharts();
    }
    
    // 정리 함수
    cleanup() {
        this.recordVisitorExit();
    }
}

// 방문자 통계 초기화
let visitorStats;

document.addEventListener('DOMContentLoaded', function() {
    // 방문자 통계 초기화
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        visitorStats = new VisitorStats();
        
        // 관리자 대시보드에서만 차트 초기화
        if (window.location.pathname.includes('admin_dashboard.html')) {
            console.log('관리자 대시보드에서 차트 초기화');
            // 차트는 이미 initializeCharts()에서 생성됨
        } else {
            console.log('메인 페이지에서 방문자 추적만 활성화');
            // 차트 관련 요소들이 없으므로 차트 생성은 건너뜀
        }
    } else {
        console.error('Firebase가 로드되지 않았습니다.');
    }
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', function() {
    if (visitorStats) {
        visitorStats.cleanup();
    }
});

// 전역 함수로 등록
window.refreshVisitorStats = function() {
    if (visitorStats) {
        visitorStats.loadVisitorStats();
        if (window.location.pathname.includes('admin_dashboard.html')) {
            visitorStats.refreshCharts();
        }
    }
};

// 일자별 방문자 추이 다운로드 함수
window.downloadDailyVisitorData = async function() {
    if (!visitorStats) {
        alert('방문자 통계가 초기화되지 않았습니다.');
        return;
    }
    
    try {
        // 로딩 표시
        const button = event.target;
        const originalText = button.innerHTML;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>데이터 준비 중...';
        button.disabled = true;
        
        // 일자별 데이터 가져오기 (최대 3개월)
        const dailyData = await visitorStats.getDailyVisitorData(3);
        
        if (dailyData.length === 0) {
            alert('다운로드할 방문자 데이터가 없습니다.');
            return;
        }
        
        // CSV 데이터 생성
        const csvContent = [
            ['날짜', '방문자수'],
            ...dailyData.map(item => [item.formattedDate, item.visitors])
        ].map(row => row.join(',')).join('\n');
        
        // 파일명 생성 (현재 날짜와 시간 포함)
        const now = new Date();
        const fileName = `VISITOR_DAILY_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}(${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}).csv`;
        
        // 파일 다운로드
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', fileName);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        alert(`일자별 방문자 추이 데이터가 다운로드되었습니다.\n파일명: ${fileName}\n총 ${dailyData.length}일의 데이터가 포함되었습니다.`);
        
    } catch (error) {
        console.error('일자별 방문자 데이터 다운로드 오류:', error);
        alert('데이터 다운로드 중 오류가 발생했습니다: ' + error.message);
    } finally {
        // 버튼 상태 복원
        const button = event.target;
        button.innerHTML = '<i class="fas fa-download me-2"></i>일자별 방문자 추이 다운로드';
        button.disabled = false;
    }
};
