import sys
import os
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                             QHBoxLayout, QPushButton, QLineEdit, QListWidget, 
                             QListWidgetItem, QLabel, QProgressBar, QFileDialog,
                             QTextEdit, QSplitter, QTreeWidget, QTreeWidgetItem,
                             QHeaderView, QFrame, QGroupBox)
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
                padding: 6px 12px;
                border-radius: 4px;
                font-weight: bold;
                font-size: 12px;
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
                padding: 6px 10px;
                border-radius: 4px;
                font-size: 13px;
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
                margin: 1px;
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
                height: 20px;
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
                font-size: 13px;
            }
            QTreeWidget {
                background-color: #2d2d2d;
                color: #ffffff;
                border: 1px solid #3e3e3e;
                border-radius: 4px;
                padding: 4px;
            }
            QTreeWidget::item {
                padding: 4px;
                border-radius: 2px;
            }
            QTreeWidget::item:hover {
                background-color: #3e3e3e;
            }
            QTreeWidget::item:selected {
                background-color: #0078d4;
            }
            QGroupBox {
                border: 1px solid #3e3e3e;
                border-radius: 4px;
                margin-top: 8px;
                padding-top: 8px;
            }
            QGroupBox::title {
                color: #ffffff;
                subcontrol-origin: margin;
                left: 10px;
                padding: 0 5px 0 5px;
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
        self.quick_scan_btn = QPushButton("Quick Scan")
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
        
        self.select_folder_btn = QPushButton("Browse")
        self.select_folder_btn.clicked.connect(self.select_folder)
        self.select_folder_btn.setFixedWidth(100)
        folder_controls.addWidget(self.select_folder_btn)
        
        self.load_root_btn = QPushButton("Load Root")
        self.load_root_btn.clicked.connect(self.load_root_directory)
        self.load_root_btn.setFixedWidth(100)
        folder_controls.addWidget(self.load_root_btn)
        
        self.scan_all_btn = QPushButton("Scan All")
        self.scan_all_btn.clicked.connect(self.scan_all_directories)
        self.scan_all_btn.setFixedWidth(100)
        folder_controls.addWidget(self.scan_all_btn)
        
        controls_layout.addLayout(folder_controls)
        controls_layout.addStretch()
        
        # Compact search section
        search_controls = QHBoxLayout()
        search_controls.setSpacing(8)
        
        self.search_input = QLineEdit()
        self.search_input.setPlaceholderText("Search files and content...")
        self.search_input.returnPressed.connect(self.perform_search)
        self.search_input.setFixedHeight(32)
        self.search_input.setMinimumWidth(300)
        search_controls.addWidget(self.search_input)
        
        self.search_btn = QPushButton("Search")
        self.search_btn.clicked.connect(self.perform_search)
        self.search_btn.setFixedWidth(80)
        self.search_btn.setFixedHeight(32)
        search_controls.addWidget(self.search_btn)
        
        controls_layout.addLayout(search_controls)
        main_layout.addWidget(controls_widget)
        
        # Status and progress section
        status_widget = QWidget()
        status_layout = QHBoxLayout(status_widget)
        status_layout.setContentsMargins(0, 0, 0, 0)
        
        self.status_label = QLabel("Ready")
        self.status_label.setStyleSheet("color: #cccccc; font-style: italic;")
        status_layout.addWidget(self.status_label)
        
        status_layout.addStretch()
        
        self.progress_bar = QProgressBar()
        self.progress_bar.setVisible(False)
        self.progress_bar.setFixedHeight(20)
        self.progress_bar.setFixedWidth(200)
        status_layout.addWidget(self.progress_bar)
        
        main_layout.addWidget(status_widget)
        
        # Main content area with folder tree and results
        content_splitter = QSplitter(Qt.Orientation.Horizontal)
        
        # Left panel - Folder tree
        left_panel = QWidget()
        left_layout = QVBoxLayout(left_panel)
        left_layout.setContentsMargins(0, 0, 0, 0)
        
        folder_group = QGroupBox("Folder Tree")
        folder_group_layout = QVBoxLayout(folder_group)
        folder_group_layout.setContentsMargins(8, 16, 8, 8)
        
        self.folder_tree = QTreeWidget()
        self.folder_tree.setHeaderLabels(["Folders"])
        self.folder_tree.setRootIsDecorated(True)
        self.folder_tree.itemClicked.connect(self.on_folder_selected)
        folder_group_layout.addWidget(self.folder_tree)
        
        left_layout.addWidget(folder_group)
        
        # Right panel - Results and preview
        right_panel = QWidget()
        right_layout = QVBoxLayout(right_panel)
        right_layout.setContentsMargins(0, 0, 0, 0)
        
        # Results section
        results_group = QGroupBox("Search Results")
        results_layout = QVBoxLayout(results_group)
        results_layout.setContentsMargins(8, 16, 8, 8)
        
        self.results_list = QListWidget()
        self.results_list.itemDoubleClicked.connect(self.open_file)
        self.results_list.itemClicked.connect(self.show_preview)
        results_layout.addWidget(self.results_list)
        
        right_layout.addWidget(preview_group)
        
        # Add panels to splitter
        content_splitter.addWidget(left_panel)
        content_splitter.addWidget(right_panel)
        content_splitter.setSizes([400, 1000])
        
        main_layout.addWidget(content_splitter)
        
        # Initialize search engine
        try:
            from search_engine import SearchEngine
            self.search_engine = SearchEngine()
            self.status_label.setText("Search engine ready")
        except Exception as e:
            self.status_label.setText(f"Error initializing search engine: {str(e)}")
        
        # Initialize folder tree
        self.populate_folder_tree()
    
    def populate_folder_tree(self):
        """Populate the folder tree with common directories"""
        self.folder_tree.clear()
        
        # Add root directories
        root_items = []
        
        # Home directory
        home_dir = os.path.expanduser("~")
        home_item = QTreeWidgetItem(["Home"])
        home_item.setData(0, Qt.ItemDataRole.UserRole, home_dir)
        root_items.append(home_item)
        
        # Desktop
        desktop_dir = os.path.join(home_dir, "Desktop")
        if os.path.exists(desktop_dir):
            desktop_item = QTreeWidgetItem(["Desktop"])
            desktop_item.setData(0, Qt.ItemDataRole.UserRole, desktop_dir)
            root_items.append(desktop_item)
        
        # Documents
        documents_dir = os.path.join(home_dir, "Documents")
        if os.path.exists(documents_dir):
            documents_item = QTreeWidgetItem(["Documents"])
            documents_item.setData(0, Qt.ItemDataRole.UserRole, documents_dir)
            root_items.append(documents_item)
        
        # Add root items to tree
        self.folder_tree.addTopLevelItems(root_items)
        
        # Expand home by default
        if root_items:
            root_items[0].setExpanded(True)
    
    def on_folder_selected(self, item):
        """Handle folder selection from tree"""
        folder_path = item.data(0, Qt.ItemDataRole.UserRole)
        if folder_path and os.path.exists(folder_path):
            self.current_folder = folder_path
            self.status_label.setText(f"Selected: {folder_path}")
    
    def quick_scan_home_directory(self):
        """Quick scan of home directory"""
        home_dir = os.path.expanduser("~")
        if os.path.exists(home_dir):
            self.current_folder = home_dir
            self.start_indexing(home_dir)
    
    def load_root_directory(self):
        """Load and scan root directory"""
        root_dir = os.path.expanduser("~")
        if os.path.exists(root_dir):
            self.current_folder = root_dir
            self.start_indexing(root_dir)
    
    def scan_all_directories(self):
        """Scan all common directories"""
        home_dir = os.path.expanduser("~")
        common_dirs = [
            home_dir,
            os.path.join(home_dir, "Desktop"),
            os.path.join(home_dir, "Documents"),
            os.path.join(home_dir, "Downloads")
        ]
        
        existing_dirs = [d for d in common_dirs if os.path.exists(d)]
        if existing_dirs:
            # For now, just scan the home directory
            # In a future enhancement, we could scan all directories
            self.current_folder = existing_dirs[0]
            self.start_indexing(existing_dirs[0])
    
    def select_folder(self):
        folder_path = QFileDialog.getExistingDirectory(
            self, 
            "Select folder to scan", 
            os.path.expanduser("~")
        )
        
        if folder_path:
            self.current_folder = folder_path
            self.status_label.setText(f"Selected: {folder_path}")
            logging.info("Selected folder: %s", folder_path)
            self.start_indexing(folder_path)
    
    def start_indexing(self, folder_path):
        logging.info("Start indexing: %s", folder_path)
        self.select_folder_btn.setEnabled(False)
        self.load_root_btn.setEnabled(False)
        self.scan_all_btn.setEnabled(False)
        self.search_btn.setEnabled(False)
        self.search_input.setEnabled(False)
        self.progress_bar.setVisible(True)
        self.progress_bar.setValue(0)
        self.status_label.setText("Scanning and indexing files...")
        
        self.indexing_worker = IndexingWorker(self.search_engine, folder_path)
        self.indexing_worker.progress_updated.connect(self.update_progress)
        self.indexing_worker.file_processed.connect(self.update_status)
        self.indexing_worker.indexing_completed.connect(self.indexing_finished)
        self.indexing_worker.start()
    
    def update_progress(self, value):
        self.progress_bar.setValue(value)
    
    def update_status(self, filename):
        self.status_label.setText(f"Processing: {os.path.basename(filename)}")
        logging.debug("Processing file: %s", filename)
    
    def indexing_finished(self):
        logging.info("Indexing finished")
        self.select_folder_btn.setEnabled(True)
        self.load_root_btn.setEnabled(True)
        self.scan_all_btn.setEnabled(True)
        self.search_btn.setEnabled(True)
        self.search_input.setEnabled(True)
        self.progress_bar.setVisible(False)
        self.status_label.setText("Indexing complete! Ready to search.")
        
        QTimer.singleShot(3000, lambda: self.status_label.setText("Ready"))
    
    def perform_search(self):
        query = self.search_input.text().strip()
        if not query or not self.search_engine:
            return
        
        logging.info("Perform search: %s", query)
        self
        preview_layout.setContentsMargins(8, 16, 8, 8)
        
        self.preview_text = QTextEdit()
        self.preview_text.setReadOnly(True)
        self.preview_text.setMaximumHeight(300)
        preview_layout.addWidget(self.preview_text)
        
        right_layout.addWidget