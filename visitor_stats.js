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
        this.initializeCharts();
        this.startTrackingCurrentVisitor();
    }
    
    // 방문자 통계 로드
    async loadVisitorStats() {
        try {
            // 총 방문자수
            const totalSnapshot = await this.visitorsRef.get();
            const totalVisitors = totalSnapshot.size;
            document.getElementById('totalVisitors').textContent = totalVisitors.toLocaleString();
            
            // 오늘 방문자수
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todaySnapshot = await this.visitorsRef
                .where('visitTime', '>=', today)
                .get();
            const todayVisitors = todaySnapshot.size;
            document.getElementById('todayVisitors').textContent = todayVisitors.toLocaleString();
            
            // 평균 체류시간 계산
            const avgStayTime = await this.calculateAverageStayTime();
            document.getElementById('avgStayTime').textContent = `${Math.round(avgStayTime)}분`;
            
            // 현재 접속자수
            const onlineSnapshot = await this.onlineRef.get();
            const currentOnline = onlineSnapshot.size;
            document.getElementById('currentOnline').textContent = currentOnline.toLocaleString();
            
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
        // 온라인 사용자 실시간 업데이트
        this.onlineRef.onSnapshot((snapshot) => {
            const currentOnline = snapshot.size;
            document.getElementById('currentOnline').textContent = currentOnline.toLocaleString();
        });
        
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
            const snapshot = await this.visitorsRef
                .orderBy('visitTime', 'desc')
                .limit(10)
                .get();
            
            const tbody = document.getElementById('recentVisitorsTable');
            
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
        this.createWeeklyChart();
        this.createStayTimeChart();
    }
    
    // 주간 방문자 차트 생성
    async createWeeklyChart() {
        try {
            const ctx = document.getElementById('weeklyChart').getContext('2d');
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
            const ctx = document.getElementById('stayTimeChart').getContext('2d');
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
            page: window.location.pathname
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
            }
        });
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
        if (this.charts.weekly) {
            this.charts.weekly.destroy();
        }
        if (this.charts.stayTime) {
            this.charts.stayTime.destroy();
        }
        
        await this.initializeCharts();
    }
}

// 방문자 통계 초기화
let visitorStats;

document.addEventListener('DOMContentLoaded', function() {
    // 방문자 통계 초기화
    if (typeof firebase !== 'undefined' && firebase.firestore) {
        visitorStats = new VisitorStats();
    } else {
        console.error('Firebase가 로드되지 않았습니다.');
    }
});

// 전역 함수로 등록
window.refreshVisitorStats = function() {
    if (visitorStats) {
        visitorStats.loadVisitorStats();
        visitorStats.refreshCharts();
    }
};
