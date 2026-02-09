import sys
import os
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QPushButton, QLineEdit, QListWidget, 
                             QListWidgetItem, QLabel, QProgressBar, QFileDialog,
                             QTextEdit, QSplitter, QTreeWidget, QTreeWidgetItem,
                             QHeaderView, QFrame)
from PyQt6.QtCore import Qt, QThread, pyqtSignal, QTimer, QMimeData
from PyQt6.QtGui import QFont, QPalette, QColor, QIcon, QDragEnterEvent, QDropEvent
import subprocess
import platform
import logging
import warnings
import urllib3

class SearchWorker(QThread):
    search_completed = pyqtSignal(list)
    
    def __init__(self, search_engine, query):
        super().__init__()
        self.search_engine = search_engine
        self.query = query
    
    def run(self):
        try:
            logging.info("SearchWorker start query: %s", self.query)
            results = self.search_engine.search(self.query)
            self.search_completed.emit(results)
        except Exception as e:
            logging.exception("SearchWorker error: %s", e)
            self.search_completed.emit([])

class IndexingWorker(QThread):
    progress_updated = pyqtSignal(int)
    indexing_completed = pyqtSignal()
    file_processed = pyqtSignal(str)
    
    def __init__(self, search_engine, folder_path):
        super().__init__()
        self.search_engine = search_engine
        self.folder_path = folder_path
    
    def run(self):
        try:
            logging.info("IndexingWorker start folder: %s", self.folder_path)
            self.search_engine.index_folder(self.folder_path, self.progress_updated, self.file_processed)
            self.indexing_completed.emit()
        except Exception as e:
            logging.exception("IndexingWorker error: %s", e)
            self.indexing_completed.emit()

class DeepSearchMainWindow(QMainWindow):
    def __init__(self):
        super().__init__()
        self.search_engine = None
        self.current_folder = None
        self.folder_tree_data = {}
        self.init_ui()
        self.setup_dark_theme()
        self.setAcceptDrops(True)
        
    def setup_dark_theme(self):
        self.setStyleSheet("""
            QMainWindow {
                background-color: #1e1e1e;
                color: #ffffff;
            }
            QWidget {
                background-color: #1e1e1e;
                color: #ffffff;
            }
            QPushButton {
                background-color: #0078d4;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-weight: bold;
            }
            QPushButton:hover {
                background-color: #106ebe;
            }
            QPushButton:pressed {
                background-color: #005a9e;
            }
            QLineEdit {
                background-color: #2d2d2d;
                color: #ffffff;
                border: 1px solid #3e3e3e;
                padding: 8px 12px;
                border-radius: 4px;
                font-size: 14px;
            }
            QLineEdit:focus {
                border: 1px solid #0078d4;
                outline: none;
            }
            QListWidget {
                background-color: #2d2d2d;
                color: #ffffff;
                border: 1px solid #3e3e3e;
                border-radius: 4px;
                padding: 4px;
            }
            QListWidget::item {
                padding: 8px;
                border-radius: 4px;
                margin: 2px;
            }
            QListWidget::item:hover {
                background-color: #3e3e3e;
            }
            QListWidget::item:selected {
                background-color: #0078d4;
            }
            QProgressBar {
                background-color: #2d2d2d;
                border: 1px solid #3e3e3e;
                border-radius: 4px;
                text-align: center;
                color: #ffffff;
            }
            QProgressBar::chunk {
                background-color: #0078d4;
                border-radius: 4px;
            }
            QTextEdit {
                background-color: #2d2d2d;
                color: #ffffff;
                border: 1px solid #3e3e3e;
                border-radius: 4px;
                padding: 8px;
            }
            QLabel {
                color: #ffffff;
                font-size: 14px;
            }
        """)
    
    def init_ui(self):
        self.setWindowTitle("Smart File Explorer")
        self.setGeometry(100, 100, 1400, 900)
        
        # Central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        main_layout = QVBoxLayout(central_widget)
        main_layout.setSpacing(12)
        main_layout.setContentsMargins(16, 16, 16, 16)
        
        # Header with improved styling
        header_widget = QWidget()
        header_layout = QHBoxLayout(header_widget)
        header_layout.setContentsMargins(0, 0, 0, 8)
        
        header_label = QLabel("Smart File Explorer")
        header_label.setStyleSheet("font-size: 20px; font-weight: bold; color: #0078d4;")
        header_layout.addWidget(header_label)
        
        header_layout.addStretch()
        
        # Quick scan button
        self.quick_scan_btn = QPushButton("📡 Quick Scan")
        self.quick_scan_btn.clicked.connect(self.quick_scan_home_directory)
        self.quick_scan_btn.setFixedWidth(120)
        header_layout.addWidget(self.quick_scan_btn)
        
        main_layout.addWidget(header_widget)
        
        # Top controls section
        controls_widget = QWidget()
        controls_layout = QHBoxLayout(controls_widget)
        controls_layout.setContentsMargins(0, 0, 0, 0)
        
        # Folder selection controls
        folder_controls = QHBoxLayout()
        folder_controls.setSpacing(8)
        
        self.select_folder_btn = QPushButton("📁 Browse")
        self.select_folder_btn.clicked.connect(self.select_folder)
        self.select_folder_btn.setFixedWidth(100)
        folder_controls.addWidget(self.select_folder_btn)
        
        self.load_root_btn = QPushButton("🏠 Load Root")
        self.load_root_btn.clicked.connect(self.load_root_directory)
        self.load_root_btn.setFixedWidth(100)
        folder_controls.addWidget(self.load_root_btn)
        
        controls_layout.addLayout(folder_controls)
        
        # Compact search section
        search_controls = QHBoxLayout()
        search_controls.setSpacing(8)
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search files and content...")
        self.search_input.returnPressed.connect(self.perform_search)
        self.search_input.setFixedHeight(32)
        self.search_input.setMinimumWidth(300)
        search_controls.addWidget(self.search_input)
        
        self.search_btn = QPushButton("🔍 Search")
        self.search_btn.clicked.connect(self.perform_search)
       
        self.setWindowTitle("DeepSearch Desktop")
        self.setGeometry(100, 100, 1200, 800)
        
        # Central widget
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        
        # Main layout
        main_layout = QVBoxLayout(central_widget)
        main_layout.setSpacing(16)
        main_layout.setContentsMargins(20, 20, 20, 20)
        
        # Header
        header_label = QLabel("DeepSearch Desktop")
        header_label.setStyleSheet("font-size: 24px; font-weight: bold; color: #0078d4; margin-bottom: 10px;")
        main_layout.addWidget(header_label)
        
        # Controls layout
        controls_layout = QHBoxLayout()
        controls_layout.setSpacing(12)
        
        # Select folder button
        self.select_folder_btn = QPushButton("📁 Chọn Thư Mục")
        self.select_folder_btn.clicked.connect(self.select_folder)
        self.select_folder_btn.setFixedWidth(150)
        controls_layout.addWidget(self.select_folder_btn)
        
        # Current folder label
        self.folder_label = QLabel("Chưa chọn thư mục")
        self.folder_label.setStyleSheet("color: #cccccc; font-style: italic;")
        controls_layout.addWidget(self.folder_label)
        
        controls_layout.addStretch()
        main_layout.addLayout(controls_layout)
        
        # Search layout
        search_layout = QHBoxLayout()
        search_layout.setSpacing(12)
        
        # Search input
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("🔍 Nhập từ khóa tìm kiếm...")
        self.search_input.returnPressed.connect(self.perform_search)
        self.search_input.setMinimumHeight(40)
        search_layout.addWidget(self.search_input)
        
        # Search button
        self.search_btn = QPushButton("🔍 Tìm Kiếm")
        self.search_btn.clicked.connect(self.perform_search)
        self.search_btn.setFixedWidth(120)
        self.search_btn.setMinimumHeight(40)
        search_layout.addWidget(self.search_btn)
        
        main_layout.addLayout(search_layout)
        
        # Progress bar
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setMinimumHeight(25)
        main_layout.addWidget(self.progress_bar)
        
        # Status label
        self.status_label = QLabel("")
        self.status_label.setStyleSheet("color: #cccccc; font-style: italic;")
        main_layout.addWidget(self.status_label)
        
        # Splitter for results and preview
        splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # Results list
        results_widget = QWidget()
        results_layout = QVBoxLayout(results_widget)
        results_layout.setContentsMargins(0, 0, 0, 0)
        
        results_label = QLabel("📋 Kết Quả Tìm Kiếm")
        results_label.setStyleSheet("font-weight: bold; margin-bottom: 8px;")
        results_layout.addWidget(results_label)
        
        self.results_list = QListWidget()
        self.results_list.itemDoubleClicked.connect(self.open_file)
        self.results_list.itemClicked.connect(self.show_preview)
        results_layout.addWidget(self.results_list)
        
        # Preview panel
        preview_widget = QWidget()
        preview_layout = QVBoxLayout(preview_widget)
        preview_layout.setContentsMargins(0, 0, 0, 0)
        
        preview_label = QLabel("👁️ Xem Trước")
        preview_label.setStyleSheet("font-weight: bold; margin-bottom: 8px;")
        preview_layout.addWidget(preview_label)
        
        self.preview_text = QTextEdit()
        self.preview_text.setReadOnly(True)
        self.preview_text.setMaximumWidth(400)
        preview_layout.addWidget(self.preview_text)
        
        # Add widgets to splitter
        splitter.addWidget(results_widget)
        splitter.addWidget(preview_widget)
        splitter.setSizes([800, 400])
        
        main_layout.addWidget(splitter)
        
        # Initialize search engine
        try:
            from search_engine import SearchEngine
            self.search_engine = SearchEngine()
            self.status_label.setText("✅ Search engine đã sẵn sàng")
        except Exception as e:
            self.status_label.setText(f"❌ Lỗi khởi tạo search engine: {str(e)}")
    
    def select_folder(self):
        folder_path = QFileDialog.getExistingDirectory(
            self, 
            "Chọn thư mục để quét", 
            os.path.expanduser("~")
        )
        
        if folder_path:
            self.current_folder = folder_path
            self.folder_label.setText(f"📁 {folder_path}")
            logging.info("Selected folder: %s", folder_path)
            self.start_indexing(folder_path)
    
    def start_indexing(self, folder_path):
        logging.info("Start indexing: %s", folder_path)
        self.select_folder_btn.setEnabled(False)
        self.search_btn.setEnabled(False)
        self.search_input.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.status_label.setText("🔍 Đang quét và lập chỉ mục file...")
        
        self.indexing_worker = IndexingWorker(self.search_engine, folder_path)
        self.indexing_worker.progress_updated.connect(self.update_progress)
        self.indexing_worker.file_processed.connect(self.update_status)
        self.indexing_worker.indexing_completed.connect(self.indexing_finished)
        self.indexing_worker.start()
    
    def update_progress(self, value):
        self.progress_bar.setValue(value)
    
    def update_status(self, filename):
        self.status_label.setText(f"🔍 Đang xử lý: {os.path.basename(filename)}")
        logging.debug("Processing file: %s", filename)
    
    def indexing_finished(self):
        logging.info("Indexing finished")
        self.select_folder_btn.setEnabled(True)
        self.search_btn.setEnabled(True)
        self.search_input.setEnabled(True)
        self.progress_bar.setVisible(False)
        self.status_label.setText("✅ Hoàn thành lập chỉ mục! Có thể tìm kiếm ngay.")
        
        QTimer.singleShot(3000, lambda: self.status_label.setText(""))
    
    def perform_search(self):
        query = self.search_input.text().strip()
        if not query or not self.search_engine:
            return
        
        logging.info("Perform search: %s", query)
        self.status_label.setText("🔍 Đang tìm kiếm...")
        self.search_btn.setEnabled(False)
        
        self.search_worker = SearchWorker(self.search_engine, query)
        self.search_worker.search_completed.connect(self.display_results)
        self.search_worker.start()
    
    def display_results(self, results):
        self.results_list.clear()
        self.preview_text.clear()
        
        if not results:
            self.status_label.setText("❌ Không tìm thấy kết quả phù hợp")
            logging.info("Search results: 0")
        else:
            self.status_label.setText(f"✅ Tìm thấy {len(results)} kết quả")
            logging.info("Search results: %d", len(results))
            
            for result in results:
                item_text = f"📄 {result['file_name']}\n📍 {result['file_path']}\n⭐ Độ tương đồng: {result['similarity']:.2f}"
                item = QListWidgetItem(item_text)
                item.setData(Qt.ItemDataRole.UserRole, result)
                self.results_list.addItem(item)
        
        self.search_btn.setEnabled(True)
        QTimer.singleShot(3000, lambda: self.status_label.setText(""))
    
    def show_preview(self, item):
        result = item.data(Qt.ItemDataRole.UserRole)
        if result:
            preview_text = f"Tệp: {result['file_name']}\n"
            preview_text += f"Đường dẫn: {result['file_path']}\n"
            preview_text += f"Độ tương đồng: {result['similarity']:.2f}\n\n"
            preview_text += f"Nội dung:\n{result['content'][:500]}..."
            self.preview_text.setPlainText(preview_text)
    
    def open_file(self, item):
        result = item.data(Qt.ItemDataRole.UserRole)
        if result:
            file_path = result['file_path']
            try:
                logging.info("Open file: %s", file_path)
                if platform.system() == 'Darwin':  # macOS
                    subprocess.run(['open', file_path])
                elif platform.system() == 'Windows':  # Windows
                    os.startfile(file_path)
                else:  # Linux
                    subprocess.run(['xdg-open', file_path])
            except Exception as e:
                self.status_label.setText(f"❌ Không thể mở file: {str(e)}")
                logging.exception("Open file error: %s", e)

def main():
    logging.basicConfig(level=logging.INFO, format='[%(asctime)s] %(levelname)s %(message)s')
    try:
        warnings.filterwarnings("ignore", category=urllib3.exceptions.NotOpenSSLWarning)
        urllib3.disable_warnings()
    except Exception:
        pass
    app = QApplication(sys.argv)
    window = DeepSearchMainWindow()
    window.show()
    sys.exit(app.exec())

if __name__ == '__main__':
    main()